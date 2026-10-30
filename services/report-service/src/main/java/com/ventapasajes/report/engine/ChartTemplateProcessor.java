package com.ventapasajes.report.engine;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.w3c.dom.Text;
import org.xml.sax.InputSource;

import com.fasterxml.jackson.databind.JsonNode;
import com.ventapasajes.report.api.ReportServiceException;

import jakarta.enterprise.context.ApplicationScoped;

/** Updates chart caches and their embedded workbook without executing template content. */
@ApplicationScoped
public class ChartTemplateProcessor {
    private static final String CHART_NS = "http://schemas.openxmlformats.org/drawingml/2006/chart";
    private static final int MAX_ENTRY_BYTES = 50 * 1024 * 1024;
    private static final long MAX_TOTAL_BYTES = 100L * 1024 * 1024;
    private static final Pattern CELL_RANGE = Pattern.compile("(?:'([^']+)'|([^!]+))!\\$?([A-Z]+)\\$?(\\d+)(?::\\$?([A-Z]+)\\$?(\\d+))?", Pattern.CASE_INSENSITIVE);

    public byte[] apply(byte[] docx, JsonNode payload) {
        JsonNode charts = payload == null ? null : payload.get("charts");
        if (charts == null || charts.isNull()) return docx;
        if (!charts.isObject()) throw invalid("El parametro charts debe ser un objeto indexado por chart1, chart2, etc.");

        Map<String, byte[]> entries = readZip(docx);
        List<CellUpdate> workbookUpdates = new ArrayList<>();
        List<String> processedKeys = new ArrayList<>();
        for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
            if (!entry.getKey().startsWith("word/charts/") || !entry.getKey().endsWith(".xml")) continue;
            String chartKey = entry.getKey().substring(entry.getKey().lastIndexOf('/') + 1, entry.getKey().length() - ".xml".length());
            JsonNode definition = charts.get(chartKey);
            if (definition == null) continue;
            if (!definition.isObject()) throw invalid("La definicion de " + chartKey + " debe ser un objeto.");
            ChartEdit edit = editChart(entry.getValue(), definition, chartKey);
            entries.put(entry.getKey(), edit.xml());
            workbookUpdates.addAll(edit.cells());
            processedKeys.add(chartKey);
        }
        Iterator<String> requested = charts.fieldNames();
        while (requested.hasNext()) {
            String key = requested.next();
            if (!processedKeys.contains(key)) throw invalid("No existe el grafico solicitado: " + key);
        }
        if (!workbookUpdates.isEmpty()) {
            List<String> workbookPaths = entries.keySet().stream()
                    .filter(name -> name.startsWith("word/embeddings/") && name.endsWith(".xlsx"))
                    .toList();
            if (workbookPaths.isEmpty()) throw invalid("El grafico no tiene un libro Excel embebido editable.");
            if (workbookPaths.size() > 1) throw invalid("La plantilla contiene varios libros Excel embebidos y el grafico no se puede asociar de forma segura.");
            String workbookPath = workbookPaths.get(0);
            entries.put(workbookPath, updateWorkbook(entries.get(workbookPath), workbookUpdates));
        }
        return writeZip(entries);
    }

    private ChartEdit editChart(byte[] bytes, JsonNode definition, String chartKey) {
        try {
            Document document = parse(bytes);
            NodeList series = document.getElementsByTagNameNS(CHART_NS, "ser");
            JsonNode requestedSeries = definition.get("series");
            JsonNode categories = definition.get("categories");
            if (categories == null || !categories.isArray() || requestedSeries == null || !requestedSeries.isArray()) {
                throw invalid("" + chartKey + " requiere categories y series como arreglos.");
            }
            if (series.getLength() != requestedSeries.size()) throw invalid("" + chartKey + " requiere " + series.getLength() + " series.");
            List<CellUpdate> cells = new ArrayList<>();
            for (int index = 0; index < series.getLength(); index++) {
                Element serie = (Element) series.item(index);
                JsonNode requested = requestedSeries.get(index);
                if (!requested.isObject() || !requested.path("name").isTextual() || !requested.path("values").isArray()) {
                    throw invalid("La serie " + index + " de " + chartKey + " requiere name y values.");
                }
                JsonNode values = requested.get("values");
                if (values.size() != categories.size()) throw invalid("Las series y categorias de " + chartKey + " deben tener la misma cantidad de puntos.");
                Element seriesNameRef = firstChild(firstChild(serie, "tx"), "strRef");
                Element seriesNameCache = firstChild(seriesNameRef, "strCache");
                Element categoryRef = firstChild(firstChild(serie, "cat"), "strRef");
                if (categoryRef == null) categoryRef = firstChild(firstChild(serie, "cat"), "numRef");
                Element categoryCache = categoryRef == null ? null : firstChild(categoryRef, categoryRef.getLocalName().equals("strRef") ? "strCache" : "numCache");
                Element valueRef = firstChild(firstChild(serie, "val"), "numRef");
                Element valueCache = valueRef == null ? null : firstChild(valueRef, "numCache");
                if (seriesNameCache == null || categoryCache == null || valueCache == null) throw invalid("El grafico " + chartKey + " no tiene cachés editables.");
                updateCache(seriesNameCache, List.of(requested.get("name")), false);
                boolean numericCategories = categoryRef != null && "numRef".equals(categoryRef.getLocalName());
                updateCache(categoryCache, jsonValues(categories), numericCategories);
                updateCache(valueCache, jsonValues(values), true);
                addFormulaUpdates(seriesNameRef, List.of(requested.get("name")), cells);
                addFormulaUpdates(categoryRef, jsonValues(categories), cells);
                addFormulaUpdates(valueRef, jsonValues(values), cells);
            }
            return new ChartEdit(writeXml(document), cells);
        } catch (ReportServiceException error) {
            throw error;
        } catch (Exception error) {
            throw invalid("No se pudo actualizar " + chartKey + ".");
        }
    }

    private void updateCache(Element cache, List<JsonNode> values, boolean numeric) {
        NodeList points = cache.getElementsByTagNameNS(CHART_NS, "pt");
        if (points.getLength() != values.size()) throw invalid("La cantidad de puntos de la plantilla no coincide con el payload.");
        Element count = firstChild(cache, "ptCount");
        if (count != null) count.setAttribute("val", "" + values.size());
        for (int index = 0; index < values.size(); index++) {
            JsonNode value = values.get(index);
            if (numeric && !value.isNumber()) throw invalid("Los valores de un grafico deben ser numericos.");
            if (!numeric && !value.isTextual()) throw invalid("Las categorias y nombres de series deben ser texto.");
            Element point = (Element) points.item(index);
            Element text = firstChild(point, "v");
            if (text == null) {
                text = point.getOwnerDocument().createElementNS(CHART_NS, "c:v");
                point.appendChild(text);
            }
            replaceText(text, numeric ? value.numberValue().toString() : value.asText());
        }
    }

    private List<JsonNode> jsonValues(JsonNode array) {
        List<JsonNode> values = new ArrayList<>();
        array.elements().forEachRemaining(values::add);
        return values;
    }

    private void addFormulaUpdates(Element reference, List<JsonNode> values, List<CellUpdate> updates) {
        if (reference == null) return;
        Element formula = firstChild(reference, "f");
        if (formula == null || formula.getTextContent().isBlank()) return;
        Matcher match = CELL_RANGE.matcher(formula.getTextContent().trim());
        if (!match.matches()) return;
        String sheet = match.group(1) != null ? match.group(1) : match.group(2);
        int startColumn = columnNumber(match.group(3));
        int startRow = Integer.parseInt(match.group(4));
        int endColumn = match.group(5) == null ? startColumn : columnNumber(match.group(5));
        int endRow = match.group(6) == null ? startRow : Integer.parseInt(match.group(6));
        if ((long) (endColumn - startColumn + 1) * (endRow - startRow + 1) != values.size()) return;
        int index = 0;
        for (int row = startRow; row <= endRow; row++) for (int column = startColumn; column <= endColumn; column++) {
            updates.add(new CellUpdate(sheet, row - 1, column - 1, values.get(index++)));
        }
    }

    private byte[] updateWorkbook(byte[] bytes, List<CellUpdate> updates) {
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes)); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            for (CellUpdate update : updates) {
                Sheet sheet = workbook.getSheet(update.sheet());
                if (sheet == null) throw invalid("No existe la hoja del grafico: " + update.sheet());
                Row row = sheet.getRow(update.row());
                if (row == null) throw invalid("No existe la fila referenciada por el grafico.");
                Cell cell = row.getCell(update.column());
                if (cell == null) throw invalid("No existe la celda referenciada por el grafico.");
                if (update.value().isNumber()) cell.setCellValue(update.value().doubleValue());
                else if (update.value().isTextual()) cell.setCellValue(update.value().asText());
                else throw invalid("El valor del libro embebido no es compatible.");
            }
            workbook.write(output);
            return output.toByteArray();
        } catch (ReportServiceException error) {
            throw error;
        } catch (Exception error) {
            throw invalid("No se pudo actualizar el libro Excel embebido del grafico.");
        }
    }

    private Map<String, byte[]> readZip(byte[] content) {
        try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(content))) {
            Map<String, byte[]> entries = new LinkedHashMap<>();
            long totalBytes = 0;
            ZipEntry entry;
            while ((entry = input.getNextEntry()) != null) {
                String name = entry.getName().replace('\\', '/');
                if (entry.isDirectory() || unsafeEntryName(name)) throw invalid("La plantilla DOCX contiene una entrada ZIP invalida.");
                if (entries.containsKey(name)) throw invalid("La plantilla DOCX contiene entradas ZIP duplicadas.");
                byte[] bytes = readEntry(input);
                totalBytes += bytes.length;
                if (totalBytes > MAX_TOTAL_BYTES) throw invalid("La plantilla DOCX supera el limite de expansion ZIP permitido.");
                entries.put(name, bytes);
            }
            return entries;
        } catch (ReportServiceException error) {
            throw error;
        } catch (IOException error) {
            throw invalid("No se pudo leer el paquete DOCX para actualizar sus graficos.");
        }
    }

    private byte[] readEntry(ZipInputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        int total = 0;
        while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > MAX_ENTRY_BYTES) throw invalid("Una entrada de la plantilla DOCX supera el limite de expansion ZIP permitido.");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private boolean unsafeEntryName(String name) {
        if (name.startsWith("/")) return true;
        for (String segment : name.split("/")) if (segment.isBlank() || ".".equals(segment) || "..".equals(segment)) return true;
        return false;
    }

    private byte[] writeZip(Map<String, byte[]> entries) {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey()));
                zip.write(entry.getValue());
                zip.closeEntry();
            }
        } catch (IOException error) {
            throw invalid("No se pudo reconstruir la plantilla DOCX con los graficos.");
        }
        return output.toByteArray();
    }

    private Document parse(byte[] bytes) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        return factory.newDocumentBuilder().parse(new InputSource(new ByteArrayInputStream(bytes)));
    }

    private byte[] writeXml(Document document) throws Exception {
        TransformerFactory factory = TransformerFactory.newInstance();
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        var transformer = factory.newTransformer();
        transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no");
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        transformer.transform(new DOMSource(document), new StreamResult(output));
        return output.toByteArray();
    }

    private Element firstChild(Element parent, String localName) {
        if (parent == null) return null;
        NodeList children = parent.getChildNodes();
        for (int index = 0; index < children.getLength(); index++) {
            Node child = children.item(index);
            if (child instanceof Element element && localName.equals(element.getLocalName())) return element;
        }
        return null;
    }

    private String text(Element parent, String localName) {
        Element child = firstChild(parent, localName);
        return child == null ? "" : child.getTextContent();
    }

    private void replaceText(Element element, String value) {
        while (element.hasChildNodes()) element.removeChild(element.getFirstChild());
        Text text = element.getOwnerDocument().createTextNode(value);
        element.appendChild(text);
    }

    private int columnNumber(String letters) {
        int result = 0;
        for (char letter : letters.toUpperCase().toCharArray()) result = result * 26 + letter - 'A' + 1;
        return result;
    }

    private ReportServiceException invalid(String message) {
        return new ReportServiceException(422, "INVALID_CHART_DATA", message);
    }

    private record ChartEdit(byte[] xml, List<CellUpdate> cells) { }
    private record CellUpdate(String sheet, int row, int column, JsonNode value) { }
}
