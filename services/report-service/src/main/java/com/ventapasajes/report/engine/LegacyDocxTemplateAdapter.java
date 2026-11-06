package com.ventapasajes.report.engine;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
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

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import com.fasterxml.jackson.databind.JsonNode;

/** Expands the legacy jt:forEach rows used by older DOCX report templates. */
public final class LegacyDocxTemplateAdapter {
    private static final String WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    private static final Pattern LOOP = Pattern.compile("<\\s*j[xt]:forEach\\b([^>]*)>", Pattern.CASE_INSENSITIVE);
    private static final Pattern CLOSE_LOOP = Pattern.compile("<\\s*/\\s*j[xt]:forEach\\s*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern EXPRESSION = Pattern.compile("\\$\\{\\s*([A-Za-z_][A-Za-z0-9_]*(?:\\s*\\.\\s*[A-Za-z_][A-Za-z0-9_]*)*)\\s*}");
    private static final Pattern ATTRIBUTE = Pattern.compile("([A-Za-z]+)\\s*=\\s*[\\\"']([^\\\"']+)[\\\"']");

    private LegacyDocxTemplateAdapter() {
    }

    public static byte[] adapt(byte[] content, JsonNode parameters) {
        if (content == null || content.length == 0 || parameters == null || !parameters.isObject()) return content;
        try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(content));
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                ZipOutputStream output = new ZipOutputStream(bytes)) {
            ZipEntry entry;
            while ((entry = input.getNextEntry()) != null) {
                byte[] value = input.readAllBytes();
                byte[] adapted = isWordXml(entry.getName()) && containsLegacyLoop(value)
                        ? adaptPart(value, parameters) : value;
                output.putNextEntry(new ZipEntry(entry.getName()));
                output.write(adapted);
                output.closeEntry();
                input.closeEntry();
            }
            output.finish();
            return bytes.toByteArray();
        } catch (IOException error) {
            throw new IllegalArgumentException("No se pudo adaptar la plantilla DOCX legacy.", error);
        }
    }

    private static byte[] adaptPart(byte[] content, JsonNode parameters) throws IOException {
        try {
            Document document = documentBuilderFactory().newDocumentBuilder().parse(new InputSource(new StringReader(new String(content, StandardCharsets.UTF_8))));
            List<Element> rows = elements(document.getElementsByTagNameNS(WORD_NS, "tr"));
            boolean changed = false;
            for (Element row : rows) {
                LoopSpec loop = loopSpec(row.getTextContent());
                if (loop == null) continue;
                JsonNode collection = atPath(parameters, loop.itemsPath());
                List<JsonNode> items = new ArrayList<>();
                if (collection != null && collection.isArray()) collection.forEach(items::add);
                Node parent = row.getParentNode();
                for (JsonNode item : items) {
                    Element clone = (Element) row.cloneNode(true);
                    replaceCells(clone, parameters, loop, item);
                    parent.insertBefore(clone, row);
                }
                parent.removeChild(row);
                changed = true;
            }
            if (!changed) return content;
            StringWriter serialized = new StringWriter();
            var transformer = TransformerFactory.newInstance().newTransformer();
            transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no");
            transformer.transform(new DOMSource(document), new StreamResult(serialized));
            return serialized.toString().getBytes(StandardCharsets.UTF_8);
        } catch (Exception error) {
            throw new IOException("No se pudo expandir una fila repetible del DOCX.", error);
        }
    }

    private static void replaceCells(Element row, JsonNode parameters, LoopSpec loop, JsonNode item) {
        for (Element cell : elements(row.getElementsByTagNameNS(WORD_NS, "tc"))) {
            List<Element> texts = elements(cell.getElementsByTagNameNS(WORD_NS, "t"));
            if (texts.isEmpty()) continue;
            replaceCellText(texts, parameters, loop, item);
        }
    }

    /**
     * Replaces tokens across multiple w:t nodes without collapsing the runs.
     * The old implementation wrote everything into the first node, which
     * removed the formatting carried by the remaining w:r elements.
     */
    private static void replaceCellText(List<Element> texts, JsonNode parameters, LoopSpec loop, JsonNode item) {
        StringBuilder combined = new StringBuilder();
        for (Element text : texts) combined.append(text.getTextContent());
        String original = combined.toString();
        List<TextOperation> operations = new ArrayList<>();
        List<int[]> protectedRanges = new ArrayList<>();

        Matcher open = LOOP.matcher(original);
        while (open.find()) {
            operations.add(new TextOperation(open.start(), open.end(), ""));
            protectedRanges.add(new int[] { open.start(), open.end() });
        }
        Matcher close = CLOSE_LOOP.matcher(original);
        while (close.find()) operations.add(new TextOperation(close.start(), close.end(), ""));

        Matcher expression = EXPRESSION.matcher(original);
        while (expression.find()) {
            if (insideAny(expression.start(), expression.end(), protectedRanges)) continue;
            String path = normalizePath(expression.group(1));
            JsonNode value = path.equals(loop.variable()) ? item
                    : path.startsWith(loop.variable() + ".")
                            ? atPath(item, path.substring(loop.variable().length() + 1))
                            : atPath(parameters, path);
            String replacement = value == null || value.isMissingNode() || value.isNull()
                    ? expression.group(0) : display(value);
            operations.add(new TextOperation(expression.start(), expression.end(), replacement));
        }

        if (operations.isEmpty()) return;
        operations.sort((left, right) -> Integer.compare(left.start(), right.start()));
        Map<Integer, List<Insertion>> insertions = new HashMap<>();
        List<boolean[]> removed = new ArrayList<>();
        List<Integer> nodeStarts = new ArrayList<>();
        int offset = 0;
        for (Element text : texts) {
            nodeStarts.add(offset);
            removed.add(new boolean[text.getTextContent().length()]);
            offset += text.getTextContent().length();
        }

        for (TextOperation operation : operations) {
            boolean inserted = false;
            for (int index = 0; index < texts.size(); index++) {
                int nodeStart = nodeStarts.get(index);
                int nodeEnd = nodeStart + texts.get(index).getTextContent().length();
                if (operation.start() < nodeEnd && operation.end() > nodeStart) {
                    if (!inserted) {
                        int insertionOffset = Math.max(0, operation.start() - nodeStart);
                        insertions.computeIfAbsent(index, ignored -> new ArrayList<>())
                                .add(new Insertion(insertionOffset, operation.replacement()));
                        inserted = true;
                    }
                    int removeStart = Math.max(0, operation.start() - nodeStart);
                    int removeEnd = Math.min(nodeEnd - nodeStart, operation.end() - nodeStart);
                    for (int character = removeStart; character < removeEnd; character++) removed.get(index)[character] = true;
                }
            }
        }

        for (int index = 0; index < texts.size(); index++) {
            String originalText = texts.get(index).getTextContent();
            List<Insertion> nodeInsertions = new ArrayList<>(insertions.getOrDefault(index, List.of()));
            nodeInsertions.sort((left, right) -> Integer.compare(left.offset(), right.offset()));
            StringBuilder result = new StringBuilder();
            int insertionIndex = 0;
            boolean[] deleted = removed.get(index);
            for (int character = 0; character <= originalText.length(); character++) {
                while (insertionIndex < nodeInsertions.size() && nodeInsertions.get(insertionIndex).offset() == character) {
                    result.append(nodeInsertions.get(insertionIndex++).value());
                }
                if (character < originalText.length() && !deleted[character]) result.append(originalText.charAt(character));
            }
            texts.get(index).setTextContent(result.toString());
        }
    }

    private static boolean insideAny(int start, int end, List<int[]> ranges) {
        return ranges.stream().anyMatch(range -> start >= range[0] && end <= range[1]);
    }

    private static LoopSpec loopSpec(String text) {
        Matcher open = LOOP.matcher(text == null ? "" : text);
        if (!open.find() || !CLOSE_LOOP.matcher(text).find(open.end())) return null;
        String items = attribute(open.group(1), "items");
        String variable = attribute(open.group(1), "var");
        String itemsPath = normalizePath(items);
        return itemsPath.isBlank() || variable == null || variable.isBlank() ? null : new LoopSpec(itemsPath, variable.trim());
    }

    private static boolean containsLegacyLoop(byte[] content) {
        String value = new String(content, StandardCharsets.UTF_8);
        return value.contains("jt:forEach") || value.contains("jx:forEach");
    }

    private static boolean isWordXml(String name) {
        return name != null && name.startsWith("word/") && name.endsWith(".xml");
    }

    private static JsonNode atPath(JsonNode node, String path) {
        if (node == null || path == null || path.isBlank()) return node;
        JsonNode current = node;
        for (String segment : path.split("\\.")) {
            if (current == null || !current.isObject()) return null;
            current = current.get(segment);
        }
        return current;
    }

    private static String display(JsonNode value) {
        return value.isValueNode() ? value.asText() : value.toString();
    }

    private static String normalizePath(String path) {
        String value = path == null ? "" : path.trim();
        Matcher expression = EXPRESSION.matcher(value);
        String normalized = expression.matches() ? expression.group(1) : value;
        return normalized.replaceAll("\\s*\\.\\s*", ".").trim();
    }

    private static String attribute(String attributes, String name) {
        Matcher matcher = ATTRIBUTE.matcher(attributes == null ? "" : attributes);
        while (matcher.find()) if (matcher.group(1).equalsIgnoreCase(name)) return matcher.group(2).trim();
        return null;
    }

    private static DocumentBuilderFactory documentBuilderFactory() throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        return factory;
    }

    private static List<Element> elements(NodeList nodes) {
        List<Element> result = new ArrayList<>();
        for (int index = 0; index < nodes.getLength(); index++) {
            Node node = nodes.item(index);
            if (node instanceof Element element) result.add(element);
        }
        return result;
    }

    private record LoopSpec(String itemsPath, String variable) {
    }

    private record TextOperation(int start, int end, String replacement) {
    }

    private record Insertion(int offset, String value) {
    }
}
