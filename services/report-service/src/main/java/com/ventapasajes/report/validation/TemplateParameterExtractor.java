package com.ventapasajes.report.validation;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import com.ventapasajes.report.domain.ParameterDataType;
import com.ventapasajes.report.domain.ParameterSource;
import com.ventapasajes.report.domain.TemplateEngineType;
import com.ventapasajes.report.domain.TemplateFeature;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class TemplateParameterExtractor {
    private static final String W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    private static final String OD_XPATH_NS = "http://opendope.org/xpaths";
    private static final String OD_CONDITION_NS = "http://opendope.org/conditions";
    private static final String CHART_NS = "http://schemas.openxmlformats.org/drawingml/2006/chart";
    private static final String PICTURE_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";
    private static final Pattern EXPRESSION = Pattern.compile("\\$\\{\\s*([A-Za-z_][A-Za-z0-9_]*(?:\\s*\\.\\s*[A-Za-z_][A-Za-z0-9_]*)*)\\s*}");
    private static final Pattern PATH_SEPARATOR_SPACES = Pattern.compile("\\s*\\.\\s*");
    private static final Pattern MERGE_FIELD = Pattern.compile("\\bMERGEFIELD\\s+([A-Za-z_][A-Za-z0-9_.-]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern JXLS_ITEMS = Pattern.compile("items\\s*=\\s*[\"']([^\"']+)[\"']");
    private static final Pattern LOOP_DECLARATION = Pattern.compile("(?:<\\s*j[xt]:forEach\\b|j[xt]:each\\s*\\()([^>)]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern ATTRIBUTE = Pattern.compile("([A-Za-z]+)\\s*=\\s*[\\\"']([^\\\"']+)[\\\"']");

    public List<ExtractedParameter> extract(String extension, byte[] content) {
        return inspect(extension, content).parameters();
    }

    public Inspection inspect(String extension, byte[] content) {
        Map<String, ExtractedParameter> values = new LinkedHashMap<>();
        if ("xlsx".equalsIgnoreCase(extension)) {
            extractXlsx(content, values);
            return new Inspection(new TemplateInspection(TemplateEngineType.LEGACY, List.of(), null, List.of()), List.copyOf(values.values()));
        }
        return inspectDocx(content, values);
    }

    private void extractXlsx(byte[] content, Map<String, ExtractedParameter> values) {
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            List<String> texts = new ArrayList<>();
            for (Sheet sheet : workbook) for (Row row : sheet) for (Cell cell : row) {
                if (cell.getCellType() == CellType.STRING) texts.add(cell.getStringCellValue());
                if (cell.getCellComment() != null) texts.add(cell.getCellComment().getString().getString().concat(" ").concat(cell.getCellComment().getAuthor()));
            }
            List<LoopAlias> aliases = loopAliases(texts);
            texts.forEach(text -> collect(text, false, values, aliases));
        } catch (Exception error) {
            throw new IllegalArgumentException("No se pudo inspeccionar la plantilla XLSX.", error);
        }
    }

    private Inspection inspectDocx(byte[] content, Map<String, ExtractedParameter> values) {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            List<String> texts = new ArrayList<>();
            Map<String, String> xmlEntries = new LinkedHashMap<>();
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (!entry.getName().endsWith(".xml") || (!entry.getName().startsWith("word/") && !entry.getName().startsWith("customXml/"))) continue;
                xmlEntries.put(entry.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
            }

            Set<TemplateFeature> features = new LinkedHashSet<>();
            Map<String, String> xpathDefinitions = new LinkedHashMap<>();
            Map<String, String> conditionDefinitions = new LinkedHashMap<>();
            String xmlRoot = readOpenDopeDefinitions(xmlEntries, xpathDefinitions, conditionDefinitions);
            Map<String, Integer> bookmarkCounts = new LinkedHashMap<>();
            List<RepeatRule> repeatRules = new ArrayList<>();
            boolean hasMergeField = false;
            boolean hasLegacyVariable = false;
            boolean hasLegacyJxls = false;
            boolean hasContentControl = false;
            boolean hasOpenDopeBinding = false;

            for (Map.Entry<String, String> xmlEntry : xmlEntries.entrySet()) {
                String name = xmlEntry.getKey();
                if (!name.startsWith("word/")) continue;
                Document document = parse(xmlEntry.getValue());
                String text = document.getDocumentElement().getTextContent();
                texts.add(text);
                hasLegacyVariable |= EXPRESSION.matcher(text).find();
                hasLegacyJxls |= text.contains("jt:");
                Matcher mergeFields = MERGE_FIELD.matcher(text);
                hasMergeField |= mergeFields.find();
                mergeFields.reset();
                while (mergeFields.find()) add(mergeFields.group(1), false, false, ParameterDataType.UNKNOWN, values);
                if (name.startsWith("word/header") || name.startsWith("word/footer")) features.add(TemplateFeature.HEADERS_FOOTERS);
                if (name.startsWith("word/charts/") || document.getElementsByTagNameNS(CHART_NS, "chart").getLength() > 0) features.add(TemplateFeature.CHARTS);
                NodeList bookmarks = document.getElementsByTagNameNS(W_NS, "bookmarkStart");
                if (bookmarks.getLength() > 0 || text.toUpperCase(java.util.Locale.ROOT).contains("TOC")) features.add(TemplateFeature.TOC_BOOKMARKS);
                for (int index = 0; index < bookmarks.getLength(); index++) {
                    String bookmarkName = ((Element) bookmarks.item(index)).getAttributeNS(W_NS, "name");
                    if (bookmarkName != null && !bookmarkName.isBlank()) bookmarkCounts.merge(bookmarkName, 1, Integer::sum);
                }
                if (document.getElementsByTagNameNS(PICTURE_NS, "pic").getLength() > 0) features.add(TemplateFeature.IMAGES);

                NodeList controls = document.getElementsByTagNameNS(W_NS, "sdt");
                if (controls.getLength() == 0) continue;
                hasContentControl = true;
                for (int index = 0; index < controls.getLength(); index++) {
                    Element control = (Element) controls.item(index);
                    String tag = childAttribute(control, W_NS, "tag", "val");
                    Map<String, String> tagValues = tagValues(tag);
                    String repeatId = tagValues.get("od:repeat");
                    if (repeatId != null && xpathDefinitions.containsKey(repeatId)) {
                        hasOpenDopeBinding = true;
                        RepeatRule repeat = repeatRule(xpathDefinitions.get(repeatId));
                        if (repeat != null) {
                            repeatRules.add(repeat);
                            add(repeat.collectionPath(), true, true, ParameterDataType.ARRAY, values);
                            features.add(TemplateFeature.REPEATS);
                        }
                    }
                    String conditionId = tagValues.get("od:condition");
                    if (conditionId != null && conditionDefinitions.containsKey(conditionId)) {
                        hasOpenDopeBinding = true;
                        String conditionPath = toJsonPath(conditionDefinitions.get(conditionId), repeatRules);
                        if (!conditionPath.isBlank()) {
                            add(conditionPath, false, false, ParameterDataType.BOOLEAN, values);
                            features.add(TemplateFeature.CONDITIONALS);
                        }
                    }
                    Element binding = childElement(control, W_NS, "dataBinding");
                    if (binding == null) continue;
                    hasOpenDopeBinding = true;
                    String path = toJsonPath(binding.getAttributeNS(W_NS, "xpath"), repeatRules);
                    if (path.isBlank()) continue;
                    boolean repeated = isInsideRepeat(binding.getAttributeNS(W_NS, "xpath"), repeatRules);
                    boolean richText = control.getElementsByTagNameNS(W_NS, "richText").getLength() > 0;
                    // A rich-text control may retain an illustrative drawing from the source template;
                    // classify the bound value as rich text unless the control explicitly declares a picture.
                    boolean image = !richText && (control.getElementsByTagNameNS(W_NS, "picture").getLength() > 0
                            || control.getElementsByTagNameNS(PICTURE_NS, "pic").getLength() > 0);
                    ParameterDataType type = image ? ParameterDataType.IMAGE : richText ? ParameterDataType.RICH_TEXT : ParameterDataType.UNKNOWN;
                    add(path, repeated, false, type, values);
                    if (image) features.add(TemplateFeature.IMAGES);
                    if (richText) features.add(TemplateFeature.RICH_TEXT);
                }
            }

            List<LoopAlias> aliases = loopAliases(texts);
            texts.forEach(text -> collect(text, false, values, aliases));
            if (hasLegacyVariable) features.add(TemplateFeature.LEGACY_VARIABLES);
            if (hasLegacyJxls) features.add(TemplateFeature.LEGACY_JXLS);
            if (hasContentControl) features.add(TemplateFeature.CONTENT_CONTROLS);
            if (hasOpenDopeBinding) {
                features.add(TemplateFeature.OPENDOPE);
                features.add(TemplateFeature.JSON_XML_BINDING);
            }
            if (hasMergeField) features.add(TemplateFeature.MERGEFIELD);
            if (features.contains(TemplateFeature.CHARTS)) addOptional("charts", false, false, ParameterDataType.OBJECT, values);
            TemplateEngineType engine = engineFor(features);
            List<String> warnings = new ArrayList<>();
            if (features.contains(TemplateFeature.OPENDOPE) && (xmlRoot == null || xmlRoot.isBlank())) warnings.add("La plantilla tiene controles OpenDoPE pero no se encontro una raiz XML de datos.");
            bookmarkCounts.forEach((name, count) -> {
                if (count > 1) warnings.add("El bookmark '" + name + "' aparece " + count + " veces y puede quedar ambiguo.");
            });
            return new Inspection(new TemplateInspection(engine, List.copyOf(features), xmlRoot, List.copyOf(warnings)), List.copyOf(values.values()));
        } catch (IOException error) {
            throw new IllegalArgumentException("No se pudo inspeccionar la plantilla DOCX.", error);
        } catch (Exception error) {
            throw new IllegalArgumentException("No se pudo leer el XML de la plantilla DOCX.", error);
        }
    }

    private TemplateEngineType engineFor(Set<TemplateFeature> features) {
        boolean openDope = features.contains(TemplateFeature.OPENDOPE);
        boolean mergeField = features.contains(TemplateFeature.MERGEFIELD);
        boolean legacy = features.contains(TemplateFeature.LEGACY_VARIABLES) || features.contains(TemplateFeature.LEGACY_JXLS);
        if (openDope && (mergeField || legacy)) return TemplateEngineType.MIXED;
        if (openDope) return TemplateEngineType.OPENDOPE;
        if (mergeField && !legacy) return TemplateEngineType.MERGEFIELD;
        return TemplateEngineType.LEGACY;
    }

    private String readOpenDopeDefinitions(Map<String, String> xmlEntries, Map<String, String> xpaths, Map<String, String> conditions) throws Exception {
        String root = null;
        for (Map.Entry<String, String> entry : xmlEntries.entrySet()) {
            if (!entry.getKey().startsWith("customXml/")) continue;
            Document document = parse(entry.getValue());
            Element documentRoot = document.getDocumentElement();
            if (documentRoot == null) continue;
            String localName = documentRoot.getLocalName();
            if (OD_XPATH_NS.equals(documentRoot.getNamespaceURI())) {
                NodeList definitions = document.getElementsByTagNameNS(OD_XPATH_NS, "xpath");
                for (int index = 0; index < definitions.getLength(); index++) {
                    Element definition = (Element) definitions.item(index);
                    Element binding = childElement(definition, OD_XPATH_NS, "dataBinding");
                    if (binding != null) xpaths.put(definition.getAttribute("id"), binding.getAttribute("xpath"));
                }
            } else if (OD_CONDITION_NS.equals(documentRoot.getNamespaceURI())) {
                NodeList definitions = document.getElementsByTagNameNS(OD_CONDITION_NS, "condition");
                for (int index = 0; index < definitions.getLength(); index++) {
                    Element definition = (Element) definitions.item(index);
                    Element reference = childElement(definition, OD_CONDITION_NS, "xpathref");
                    if (reference != null) conditions.put(definition.getAttribute("id"), xpaths.get(reference.getAttribute("id")));
                }
            } else if (localName != null && !Set.of("conditions", "questions", "xpaths", "datastoreItem").contains(localName) && root == null) {
                root = localName;
            }
        }
        // A ZIP entry order is not a contract; resolve condition references again after all XPath parts are known.
        for (Map.Entry<String, String> entry : xmlEntries.entrySet()) {
            if (!entry.getKey().startsWith("customXml/")) continue;
            Document document = parse(entry.getValue());
            if (!OD_CONDITION_NS.equals(document.getDocumentElement().getNamespaceURI())) continue;
            NodeList definitions = document.getElementsByTagNameNS(OD_CONDITION_NS, "condition");
            for (int index = 0; index < definitions.getLength(); index++) {
                Element definition = (Element) definitions.item(index);
                Element reference = childElement(definition, OD_CONDITION_NS, "xpathref");
                if (reference != null) conditions.put(definition.getAttribute("id"), xpaths.get(reference.getAttribute("id")));
            }
        }
        return root;
    }

    private Document parse(String xml) throws Exception {
        if (xml != null && !xml.isEmpty() && xml.charAt(0) == '\uFEFF') xml = xml.substring(1);
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        return factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
    }

    private Element childElement(Element parent, String namespace, String localName) {
        NodeList nodes = parent.getElementsByTagNameNS(namespace, localName);
        return nodes.getLength() == 0 ? null : (Element) nodes.item(0);
    }

    private String childAttribute(Element parent, String namespace, String localName, String attribute) {
        Element child = childElement(parent, namespace, localName);
        return child == null ? "" : child.getAttributeNS(namespace, attribute);
    }

    private Map<String, String> tagValues(String tag) {
        Map<String, String> values = new LinkedHashMap<>();
        if (tag == null) return values;
        for (String item : tag.split("&")) {
            int separator = item.indexOf('=');
            if (separator > 0) values.put(item.substring(0, separator).trim(), item.substring(separator + 1).trim());
        }
        return values;
    }

    private RepeatRule repeatRule(String xpath) {
        List<String> parts = xpathParts(xpath);
        if (parts.isEmpty()) return null;
        List<String> collection = new ArrayList<>(parts);
        if ("item".equalsIgnoreCase(collection.get(collection.size() - 1)) && collection.size() > 1) collection.remove(collection.size() - 1);
        return new RepeatRule(parts, String.join(".", collection));
    }

    private boolean isInsideRepeat(String xpath, List<RepeatRule> repeats) {
        List<String> parts = xpathParts(xpath);
        return repeats.stream().anyMatch(rule -> startsWith(parts, rule.parts()));
    }

    private String toJsonPath(String xpath, List<RepeatRule> repeats) {
        List<String> parts = xpathParts(xpath);
        if (parts.isEmpty()) return "";
        return repeats.stream()
                .filter(rule -> startsWith(parts, rule.parts()))
                .max(Comparator.comparingInt(rule -> rule.parts().size()))
                .map(rule -> {
                    List<String> remainder = parts.subList(rule.parts().size(), parts.size());
                    return rule.collectionPath() + (remainder.isEmpty() ? "" : "." + String.join(".", remainder));
                })
                .orElse(String.join(".", parts));
    }

    private List<String> xpathParts(String xpath) {
        if (xpath == null || xpath.isBlank()) return List.of();
        List<String> parts = new ArrayList<>();
        for (String raw : xpath.split("/")) {
            String part = raw.replaceAll("\\[[^]]*\\]", "").trim();
            if (!part.isBlank()) parts.add(part.contains(":") ? part.substring(part.indexOf(':') + 1) : part);
        }
        if (!parts.isEmpty()) parts.remove(0);
        return parts;
    }

    private boolean startsWith(List<String> source, List<String> prefix) {
        if (source.size() < prefix.size()) return false;
        for (int index = 0; index < prefix.size(); index++) if (!source.get(index).equals(prefix.get(index))) return false;
        return true;
    }

    private void collect(String text, boolean repeated, Map<String, ExtractedParameter> values, List<LoopAlias> aliases) {
        Matcher matcher = EXPRESSION.matcher(text == null ? "" : text);
        while (matcher.find()) {
            String rawPath = normalizePath(matcher.group(1));
            LoopAlias alias = aliases.stream()
                    .filter(value -> rawPath.equals(value.variable()) || rawPath.startsWith(value.variable() + "."))
                    .findFirst().orElse(null);
            String path = alias == null ? rawPath : alias.collectionPath() + rawPath.substring(alias.variable().length());
            boolean mappedCollection = alias != null && path.equals(alias.collectionPath());
            add(path, repeated || alias != null, mappedCollection, mappedCollection ? ParameterDataType.ARRAY : ParameterDataType.UNKNOWN, values);
        }
        Matcher items = JXLS_ITEMS.matcher(text == null ? "" : text);
        while (items.find()) add(items.group(1), true, true, ParameterDataType.ARRAY, values);
    }

    private List<LoopAlias> loopAliases(List<String> texts) {
        Map<String, LoopAlias> aliases = new LinkedHashMap<>();
        texts.forEach(text -> {
            Matcher declaration = LOOP_DECLARATION.matcher(text == null ? "" : text);
            while (declaration.find()) {
                String items = attribute(declaration.group(1), "items");
                String variable = attribute(declaration.group(1), "var");
                String collectionPath = normalizePath(items);
                if (variable != null && !variable.isBlank() && !collectionPath.isBlank()) aliases.put(variable.trim(), new LoopAlias(variable.trim(), collectionPath));
            }
        });
        return List.copyOf(aliases.values());
    }

    private void add(String path, boolean repeated, boolean collection, ParameterDataType dataType, Map<String, ExtractedParameter> values) {
        String normalizedPath = normalizePath(path);
        if (normalizedPath.isBlank()) return;
        String root = normalizedPath.split("\\.", 2)[0];
        ExtractedParameter previous = values.get(normalizedPath);
        if (previous == null) {
            values.put(normalizedPath, new ExtractedParameter(root, normalizedPath, dataType, !normalizedPath.contains(".") && !collection, repeated, collection, null, null, ParameterSource.EXTRACTED));
            return;
        }
        ParameterDataType resolvedType = previous.dataType() == ParameterDataType.UNKNOWN ? dataType : previous.dataType();
        if (repeated || collection || resolvedType != previous.dataType()) {
            values.put(normalizedPath, new ExtractedParameter(previous.name(), previous.path(), resolvedType, previous.required(), previous.repeated() || repeated, previous.collection() || collection, previous.defaultValue(), previous.description(), previous.source()));
        }
    }

    private void addOptional(String path, boolean repeated, boolean collection, ParameterDataType dataType, Map<String, ExtractedParameter> values) {
        add(path, repeated, collection, dataType, values);
        ExtractedParameter previous = values.get(normalizePath(path));
        if (previous != null) values.put(previous.path(), new ExtractedParameter(previous.name(), previous.path(), previous.dataType(), false, previous.repeated(), previous.collection(), previous.defaultValue(), previous.description(), previous.source()));
    }

    private String normalizePath(String path) {
        String value = path == null ? "" : path.trim();
        Matcher expression = EXPRESSION.matcher(value);
        String normalized = expression.matches() ? expression.group(1) : value;
        return PATH_SEPARATOR_SPACES.matcher(normalized).replaceAll(".").trim();
    }

    private String attribute(String attributes, String name) {
        Matcher matcher = ATTRIBUTE.matcher(attributes == null ? "" : attributes);
        while (matcher.find()) if (matcher.group(1).equalsIgnoreCase(name)) return matcher.group(2).trim();
        return null;
    }

    public record Inspection(TemplateInspection metadata, List<ExtractedParameter> parameters) { }
    public record ExtractedParameter(String name, String path, ParameterDataType dataType, boolean required, boolean repeated, boolean collection, Object defaultValue, String description, ParameterSource source) { }
    private record LoopAlias(String variable, String collectionPath) { }
    private record RepeatRule(List<String> parts, String collectionPath) { }
}
