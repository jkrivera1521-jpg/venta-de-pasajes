package com.ventapasajes.report.engine;

import java.io.ByteArrayInputStream;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;

import org.docx4j.TraversalUtil;
import org.docx4j.openpackaging.parts.JaxbXmlPart;
import org.docx4j.openpackaging.parts.Part;
import org.docx4j.openpackaging.parts.WordprocessingML.FooterPart;
import org.docx4j.openpackaging.parts.WordprocessingML.HeaderPart;
import org.docx4j.openpackaging.parts.WordprocessingML.MainDocumentPart;
import org.docx4j.openpackaging.packages.WordprocessingMLPackage;
import org.docx4j.wml.SdtElement;
import org.docx4j.wml.Text;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import com.fasterxml.jackson.databind.JsonNode;

/** Fixes scalar bindings inside nested OpenDoPE repeats after docx4j cloning. */
final class NestedOpenDopeBindingAdapter {
    private static final String WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    private static final String OD_XPATH_NS = "http://opendope.org/xpaths";
    private static final Pattern REPEAT_TAG = Pattern.compile("(?:^|&)od:xpath=([^&]+)");
    private static final Pattern INDEX = Pattern.compile("(?:^|_)(\\d+)");

    void apply(WordprocessingMLPackage document, byte[] template, JsonNode parameters) {
        Map<String, String> paths = xpathDefinitions(template);
        if (paths.isEmpty()) return;
        for (Part part : document.getParts().getParts().values()) {
            if (!(part instanceof JaxbXmlPart<?> xmlPart)) continue;
            if (!(part instanceof MainDocumentPart || part instanceof HeaderPart || part instanceof FooterPart)) continue;
            TraversalUtil.visit(xmlPart.getJaxbElement(), new TraversalUtil.CallbackImpl() {
                @Override
                public List<Object> apply(Object value) {
                    if (!(value instanceof SdtElement control) || control.getSdtPr() == null || control.getSdtPr().getTag() == null) return null;
                    String tag = control.getSdtPr().getTag().getVal();
                    Matcher matcher = REPEAT_TAG.matcher(tag == null ? "" : tag);
                    if (!matcher.find()) return null;
                    String taggedId = matcher.group(1);
                    int separator = taggedId.indexOf('_');
                    if (separator < 0) return null;
                    String baseId = taggedId.substring(0, separator);
                    String xpath = paths.get(baseId);
                    if (xpath == null) return null;
                    List<Integer> repeatIndexes = parseIndexes(taggedId.substring(separator));
                    JsonNode resolved = resolve(parameters, xpath, repeatIndexes);
                    if (resolved == null || resolved.isMissingNode() || resolved.isNull()) return null;
                    replaceText(control, display(resolved));
                    return null;
                }
            });
        }
    }

    private Map<String, String> xpathDefinitions(byte[] template) {
        Map<String, String> paths = new HashMap<>();
        if (template == null) return paths;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(template))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                byte[] content = zip.readAllBytes();
                if (entry.getName().startsWith("customXml/") && entry.getName().endsWith(".xml")) readDefinitions(content, paths);
                if (entry.getName().startsWith("word/") && entry.getName().endsWith(".xml")) readDirectBindings(content, paths);
            }
        } catch (Exception ignored) {
            // The normal OpenDoPE binding remains authoritative if this optional repair cannot parse a part.
        }
        return paths;
    }

    private void readDefinitions(byte[] content, Map<String, String> paths) throws Exception {
        Document document = parse(new String(content, StandardCharsets.UTF_8));
        if (!OD_XPATH_NS.equals(document.getDocumentElement().getNamespaceURI())) return;
        NodeList xpathNodes = document.getElementsByTagNameNS(OD_XPATH_NS, "xpath");
        for (int index = 0; index < xpathNodes.getLength(); index++) {
            Element xpath = (Element) xpathNodes.item(index);
            NodeList bindings = xpath.getElementsByTagNameNS(OD_XPATH_NS, "dataBinding");
            if (bindings.getLength() == 0) continue;
            String id = xpath.getAttribute("id");
            String path = ((Element) bindings.item(0)).getAttribute("xpath");
            if (!id.isBlank() && !path.isBlank()) paths.putIfAbsent(id, path);
        }
    }

    private void readDirectBindings(byte[] content, Map<String, String> paths) throws Exception {
        Document document = parse(new String(content, StandardCharsets.UTF_8));
        NodeList controls = document.getElementsByTagNameNS(WORD_NS, "sdt");
        for (int index = 0; index < controls.getLength(); index++) {
            Element control = (Element) controls.item(index);
            String tag = childAttribute(control, WORD_NS, "tag", "val");
            String id = tagValue(tag, "od:xpath");
            Element binding = childElement(control, WORD_NS, "dataBinding");
            if (id != null && binding != null) paths.putIfAbsent(id, binding.getAttributeNS(WORD_NS, "xpath"));
        }
    }

    private JsonNode resolve(JsonNode root, String xpath, List<Integer> repeatIndexes) {
        List<PathSegment> segments = new ArrayList<>();
        for (String raw : xpath.split("/")) {
            if (raw.isBlank()) continue;
            String name = raw.replaceAll("\\[[^]]*\\]", "");
            if (!name.isBlank()) segments.add(new PathSegment(name.contains(":") ? name.substring(name.indexOf(':') + 1) : name, firstIndex(raw)));
        }
        if (segments.size() > 1) segments.remove(0);
        return resolve(root, segments, 0, repeatIndexes, 0);
    }

    private JsonNode resolve(JsonNode current, List<PathSegment> segments, int position, List<Integer> repeats, int repeatDepth) {
        if (current == null || current.isMissingNode()) return null;
        if (position >= segments.size()) return current;
        if (current.isArray()) {
            if (current.isEmpty()) return null;
            int index = repeatDepth < repeats.size() ? repeats.get(repeatDepth) : segments.get(position).index() == null ? 0 : segments.get(position).index() - 1;
            if (index < 0 || index >= current.size()) return null;
            return resolve(current.get(index), segments, position + 1, repeats, repeatDepth + 1);
        }
        if (!current.isObject()) return null;
        JsonNode child = current.get(segments.get(position).name());
        return child == null ? null : resolve(child, segments, position + 1, repeats, repeatDepth);
    }

    private void replaceText(SdtElement control, String value) {
        List<Text> texts = new ArrayList<>();
        TraversalUtil.visit(control.getSdtContent(), new TraversalUtil.CallbackImpl() {
            @Override
            public List<Object> apply(Object element) {
                if (element instanceof Text text) texts.add(text);
                return null;
            }
        });
        if (texts.isEmpty()) return;
        texts.get(0).setValue(value);
        for (int index = 1; index < texts.size(); index++) texts.get(index).setValue("");
    }

    private String display(JsonNode value) {
        return value.isValueNode() ? value.asText() : value.toString();
    }

    private List<Integer> parseIndexes(String suffix) {
        List<Integer> result = new ArrayList<>();
        Matcher matcher = INDEX.matcher(suffix);
        while (matcher.find()) result.add(Integer.parseInt(matcher.group(1)));
        return result;
    }

    private Integer firstIndex(String value) {
        Matcher matcher = Pattern.compile("\\[(\\d+)\\]").matcher(value);
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : null;
    }

    private String tagValue(String tag, String key) {
        if (tag == null) return null;
        for (String part : tag.split("&")) {
            int separator = part.indexOf('=');
            if (separator > 0 && key.equals(part.substring(0, separator).trim())) return part.substring(separator + 1).trim();
        }
        return null;
    }

    private String childAttribute(Element parent, String namespace, String localName, String attribute) {
        Element child = childElement(parent, namespace, localName);
        return child == null ? "" : child.getAttributeNS(namespace, attribute);
    }

    private Element childElement(Element parent, String namespace, String localName) {
        NodeList nodes = parent.getElementsByTagNameNS(namespace, localName);
        return nodes.getLength() == 0 ? null : (Element) nodes.item(0);
    }

    private Document parse(String xml) throws Exception {
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

    private record PathSegment(String name, Integer index) {
    }
}
