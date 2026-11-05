package com.ventapasajes.report.engine;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;

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
    private static final String SPREADSHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static final String PACKAGE_RELATIONSHIP_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
    private static final String DOCUMENT_RELATIONSHIP_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static final int MAX_ENTRY_BYTES = 50 * 1024 * 1024;
    private static final long MAX_TOTAL_BYTES = 100L * 1024 * 1024;
    private static final Pattern CELL_RANGE = Pattern.compile("(?:'([^']+)'|([^!]+))!\\$?([A-Z]+)\\$?(\\d+)(?::\\$?([A-Z]+)\\$?(\\d+))?", Pattern.CASE_INSENSITIVE);
    private static final Pattern XML_TYPE_ATTRIBUTE = Pattern.compile("\\s+t\\s*=\\s*(['\"])[^'\"]*\\1");

    public byte[] apply(byte[] docx, JsonNode payload) {
        JsonNode charts = payload == null ? null : payload.get("charts");
        if (charts == null || charts.isNull()) return docx;
        if (!charts.isObject()) throw invalid("El parametro charts debe ser un objeto indexado por chart1, chart2, etc.");

        Map<String, byte[]> entries = readZip(docx);
        Map<String, List<CellUpdate>> workbookUpdates = new LinkedHashMap<>();
        List<String> processedKeys = new ArrayList<>();
        for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
            if (!entry.getKey().startsWith("word/charts/") || !entry.getKey().endsWith(".xml")) continue;
            String chartKey = entry.getKey().substring(entry.getKey().lastIndexOf('/') + 1, entry.getKey().length() - ".xml".length());
            JsonNode definition = charts.get(chartKey);
            if (definition == null) continue;
            if (!definition.isObject()) throw invalid("La definicion de " + chartKey + " debe ser un objeto.");
            ChartEdit edit = editChart(entry.getValue(), definition, chartKey);
            entries.put(entry.getKey(), edit.xml());
            if (!edit.cells().isEmpty()) {
                String workbookPath = chartWorkbookPath(entries, entry.getKey());
                if (workbookPath == null || !entries.containsKey(workbookPath)) {
                    throw invalid("El grafico " + chartKey + " no tiene un libro Excel embebido editable.");
                }
                workbookUpdates.computeIfAbsent(workbookPath, ignored -> new ArrayList<>()).addAll(edit.cells());
            }
            processedKeys.add(chartKey);
        }
        Iterator<String> requested = charts.fieldNames();
        while (requested.hasNext()) {
            String key = requested.next();
            if (!processedKeys.contains(key)) throw invalid("No existe el grafico solicitado: " + key);
        }
        for (Map.Entry<String, List<CellUpdate>> workbookUpdate : workbookUpdates.entrySet()) {
            String workbookPath = workbookUpdate.getKey();
            entries.put(workbookPath, updateEmbeddedWorkbook(entries.get(workbookPath), workbookUpdate.getValue()));
        }
        return writeZip(entries);
    }

    private String chartWorkbookPath(Map<String, byte[]> entries, String chartPath) {
        int slash = chartPath.lastIndexOf('/');
        if (slash < 0) return null;
        String fileName = chartPath.substring(slash + 1);
        String relationshipsPath = chartPath.substring(0, slash + 1) + "_rels/" + fileName + ".rels";
        byte[] relationshipsBytes = entries.get(relationshipsPath);
        if (relationshipsBytes == null) return null;
        try {
            Document relationships = parse(relationshipsBytes);
            NodeList relationshipNodes = relationships.getElementsByTagNameNS(PACKAGE_RELATIONSHIP_NS, "Relationship");
            String workbookPath = null;
            for (int index = 0; index < relationshipNodes.getLength(); index++) {
                Element relationship = (Element) relationshipNodes.item(index);
                String target = relationship.getAttribute("Target");
                String type = relationship.getAttribute("Type");
                if (!target.toLowerCase().endsWith(".xlsx") || !type.endsWith("/package")) continue;
                if (workbookPath != null) throw invalid("El grafico tiene varios libros Excel embebidos asociados.");
                workbookPath = resolvePartPath(chartPath, target);
            }
            return workbookPath;
        } catch (ReportServiceException error) {
            throw error;
        } catch (Exception error) {
            throw invalid("No se pudo localizar el libro Excel del grafico.");
        }
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
            List<String> cacheValues = new ArrayList<>();
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
                cacheValues.add(xmlText(requested.get("name").asText()));
                for (JsonNode category : jsonValues(categories)) cacheValues.add(xmlText(category.asText()));
                for (JsonNode value : jsonValues(values)) cacheValues.add(value.numberValue().toString());
                addFormulaUpdates(seriesNameRef, List.of(requested.get("name")), cells);
                // Keep numeric category cells from being rewritten in the embedded
                // workbook. Date axes commonly use a numeric cache while the source
                // worksheet stores display labels as inline strings; changing those
                // cells to numeric values makes Word reject the generated package.
                if (!numericCategories) addFormulaUpdates(categoryRef, jsonValues(categories), cells);
                addFormulaUpdates(valueRef, jsonValues(values), cells);
            }
            return new ChartEdit(patchChartCacheValues(bytes, cacheValues).getBytes(StandardCharsets.UTF_8), cells);
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

    private byte[] updateEmbeddedWorkbook(byte[] bytes, List<CellUpdate> updates) {
        Map<String, byte[]> workbookEntries = readZip(bytes);
        Map<String, String> worksheetPaths = worksheetPaths(workbookEntries);
        Map<String, List<CellUpdate>> updatesBySheet = new LinkedHashMap<>();
        for (CellUpdate update : updates) updatesBySheet.computeIfAbsent(update.sheet(), ignored -> new ArrayList<>()).add(update);
        for (Map.Entry<String, List<CellUpdate>> entry : updatesBySheet.entrySet()) {
            String worksheetPath = worksheetPaths.get(entry.getKey());
            if (worksheetPath == null) throw invalid("No existe la hoja del grafico: " + entry.getKey());
            byte[] worksheet = workbookEntries.get(worksheetPath);
            if (worksheet == null) throw invalid("No se encontro la hoja del grafico: " + entry.getKey());
            workbookEntries.put(worksheetPath, updateWorksheet(worksheet, entry.getValue()));
        }
        return writeZip(workbookEntries);
    }

    private Map<String, String> worksheetPaths(Map<String, byte[]> workbookEntries) {
        try {
            Document workbook = parse(requireEntry(workbookEntries, "xl/workbook.xml"));
            Document relationships = parse(requireEntry(workbookEntries, "xl/_rels/workbook.xml.rels"));
            Map<String, String> targetsById = new LinkedHashMap<>();
            NodeList relationshipNodes = relationships.getElementsByTagNameNS(PACKAGE_RELATIONSHIP_NS, "Relationship");
            for (int index = 0; index < relationshipNodes.getLength(); index++) {
                Element relationship = (Element) relationshipNodes.item(index);
                targetsById.put(relationship.getAttribute("Id"), resolvePartPath("xl/workbook.xml", relationship.getAttribute("Target")));
            }
            Map<String, String> result = new LinkedHashMap<>();
            NodeList sheets = workbook.getElementsByTagNameNS(SPREADSHEET_NS, "sheet");
            for (int index = 0; index < sheets.getLength(); index++) {
                Element sheet = (Element) sheets.item(index);
                String relationshipId = sheet.getAttributeNS(DOCUMENT_RELATIONSHIP_NS, "id");
                String path = targetsById.get(relationshipId);
                if (path != null) result.put(sheet.getAttribute("name"), path);
            }
            return result;
        } catch (ReportServiceException error) {
            throw error;
        } catch (Exception error) {
            throw invalid("No se pudo localizar las hojas del libro Excel embebido.");
        }
    }

    private byte[] updateWorksheet(byte[] bytes, List<CellUpdate> updates) {
        try {
            Document worksheet = parse(bytes);
            Map<String, Element> cellsByReference = new LinkedHashMap<>();
            NodeList cells = worksheet.getElementsByTagNameNS(SPREADSHEET_NS, "c");
            for (int index = 0; index < cells.getLength(); index++) {
                Element cell = (Element) cells.item(index);
                cellsByReference.put(cell.getAttribute("r"), cell);
            }
            String xml = new String(bytes, StandardCharsets.UTF_8);
            for (CellUpdate update : updates) {
                String reference = cellReference(update.row(), update.column());
                Element cell = cellsByReference.get(reference);
                if (cell == null) throw invalid("No existe la celda " + update.sheet() + "!" + reference + " referenciada por el grafico.");
                xml = patchWorksheetCell(xml, reference, update.value());
            }
            return xml.getBytes(StandardCharsets.UTF_8);
        } catch (ReportServiceException error) {
            throw error;
        } catch (Exception error) {
            throw invalid("No se pudo actualizar la hoja del libro Excel embebido.");
        }
    }

    private byte[] requireEntry(Map<String, byte[]> entries, String path) {
        byte[] content = entries.get(path);
        if (content == null) throw invalid("El libro Excel embebido no contiene " + path + ".");
        return content;
    }

    private String resolvePartPath(String sourcePart, String target) {
        String raw = target.replace('\\', '/');
        if (raw.startsWith("/")) raw = raw.substring(1);
        else {
            int slash = sourcePart.lastIndexOf('/');
            raw = (slash < 0 ? "" : sourcePart.substring(0, slash + 1)) + raw;
        }
        List<String> segments = new ArrayList<>();
        for (String segment : raw.split("/")) {
            if (segment.isBlank() || ".".equals(segment)) continue;
            if ("..".equals(segment)) {
                if (segments.isEmpty()) throw invalid("La relacion del libro Excel apunta fuera del paquete.");
                segments.remove(segments.size() - 1);
            } else segments.add(segment);
        }
        return String.join("/", segments);
    }

    private String patchChartCacheValues(byte[] bytes, List<String> values) {
        String xml = new String(bytes, StandardCharsets.UTF_8);
        Matcher root = Pattern.compile("<([A-Za-z_][\\w.-]*):chartSpace\\b").matcher(xml);
        if (!root.find()) throw invalid("El grafico no tiene un elemento chartSpace valido.");
        String prefix = root.group(1);
        Pattern cacheValue = Pattern.compile("(<" + Pattern.quote(prefix) + ":v(?:\\s[^>]*)?>)(.*?)(</" + Pattern.quote(prefix) + ":v>)", Pattern.DOTALL);
        Matcher matcher = cacheValue.matcher(xml);
        StringBuffer patched = new StringBuffer();
        int index = 0;
        while (matcher.find()) {
            if (index >= values.size()) throw invalid("El grafico contiene mas valores de cache de los esperados.");
            matcher.appendReplacement(patched, Matcher.quoteReplacement(matcher.group(1) + values.get(index++) + matcher.group(3)));
        }
        if (index != values.size()) throw invalid("El grafico no contiene todos los valores de cache esperados.");
        matcher.appendTail(patched);
        return patched.toString();
    }

    private String patchWorksheetCell(String xml, String reference, JsonNode value) {
        if (!value.isNumber() && !value.isTextual()) throw invalid("El valor del libro embebido no es compatible.");
        Pattern cellPattern = Pattern.compile("(<(?:[A-Za-z_][\\w.-]*:)?c\\b[^>]*\\br\\s*=\\s*['\\\"]" + Pattern.quote(reference) + "['\\\"][^>]*>)(.*?)(</(?:[A-Za-z_][\\w.-]*:)?c>)", Pattern.DOTALL);
        Matcher matcher = cellPattern.matcher(xml);
        if (!matcher.find()) throw invalid("No se pudo actualizar la celda " + reference + " del libro Excel embebido.");
        String opening = XML_TYPE_ATTRIBUTE.matcher(matcher.group(1)).replaceAll("");
        opening = opening.substring(0, opening.length() - 1) + " t=\"" + (value.isNumber() ? "n" : "inlineStr") + "\">";
        String body = removeCellValueNodes(matcher.group(2));
        String replacement = opening + body + (value.isNumber()
                ? "<v>" + value.numberValue() + "</v>"
                : "<is><t>" + xmlText(value.asText()) + "</t></is>") + matcher.group(3);
        return matcher.replaceFirst(Matcher.quoteReplacement(replacement));
    }

    private String removeCellValueNodes(String body) {
        // SpreadsheetML permits only one value representation per cell. Remove
        // both forms independently so a stale <v> can never remain beside <is>.
        body = body.replaceAll("(?s)<(?:[A-Za-z_][\\w.-]*:)?v(?:\\s[^>]*)?>.*?</(?:[A-Za-z_][\\w.-]*:)?v>", "");
        body = body.replaceAll("(?s)<(?:[A-Za-z_][\\w.-]*:)?is(?:\\s[^>]*)?>.*?</(?:[A-Za-z_][\\w.-]*:)?is>", "");
        body = body.replaceAll("(?s)<(?:[A-Za-z_][\\w.-]*:)?(?:v|is)(?:\\s[^>]*)?/>", "");
        return body;
    }

    private String xmlText(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    private String cellReference(int row, int column) {
        StringBuilder letters = new StringBuilder();
        int value = column + 1;
        while (value > 0) {
            int remainder = (value - 1) % 26;
            letters.insert(0, (char) ('A' + remainder));
            value = (value - 1) / 26;
        }
        return letters + Integer.toString(row + 1);
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
        try (ZipOutputStream zip = new ZipOutputStream(output, Charset.forName("Cp437"))) {
            for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                byte[] content = entry.getValue();
                CRC32 crc = new CRC32();
                crc.update(content);
                ZipEntry zipEntry = new ZipEntry(entry.getKey());
                // Office readers are stricter with nested OPC packages than a generic ZIP
                // reader. Declare stored entries fully so neither package uses data
                // descriptors or implementation-specific UTF-8 flags.
                zipEntry.setMethod(ZipEntry.STORED);
                zipEntry.setSize(content.length);
                zipEntry.setCompressedSize(content.length);
                zipEntry.setCrc(crc.getValue());
                zip.putNextEntry(zipEntry);
                zip.write(content);
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
