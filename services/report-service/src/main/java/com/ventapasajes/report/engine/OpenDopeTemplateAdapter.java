package com.ventapasajes.report.engine;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

/** Repairs incomplete OpenDoPE XPath metadata produced by some Word authoring flows. */
public final class OpenDopeTemplateAdapter {
    private static final String WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    private static final String OD_XPATH_NS = "http://opendope.org/xpaths";

    private OpenDopeTemplateAdapter() {
    }

    public static byte[] repair(byte[] content) {
        if (content == null || content.length == 0) return content;
        try {
            Map<String, byte[]> entries = readEntries(content);
            Map<String, XpathSpec> definitions = findXpathSpecs(entries);
            if (definitions.isEmpty()) return content;

            boolean changed = false;
            for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                if (!entry.getKey().startsWith("customXml/") || !entry.getKey().endsWith(".xml")) continue;
                byte[] repaired = addMissingXpaths(entry.getValue(), definitions);
                if (repaired != null) {
                    entry.setValue(repaired);
                    changed = true;
                }
            }
            return changed ? writeEntries(entries) : content;
        } catch (Exception error) {
            throw new IllegalArgumentException("No se pudo reparar la metadata OpenDoPE de la plantilla DOCX.", error);
        }
    }

    private static Map<String, byte[]> readEntries(byte[] content) throws IOException {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(content))) {
            ZipEntry entry;
            while ((entry = input.getNextEntry()) != null) {
                entries.put(entry.getName(), input.readAllBytes());
                input.closeEntry();
            }
        }
        return entries;
    }

    private static byte[] writeEntries(Map<String, byte[]> entries) throws IOException {
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream(); ZipOutputStream output = new ZipOutputStream(bytes)) {
            for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                output.putNextEntry(new ZipEntry(entry.getKey()));
                output.write(entry.getValue());
                output.closeEntry();
            }
            output.finish();
            return bytes.toByteArray();
        }
    }

    private static Map<String, XpathSpec> findXpathSpecs(Map<String, byte[]> entries) throws Exception {
        Map<String, XpathSpec> definitions = new LinkedHashMap<>();
        for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
            if (!entry.getKey().startsWith("word/") || !entry.getKey().endsWith(".xml")) continue;
            Document document = parse(new String(entry.getValue(), StandardCharsets.UTF_8));
            NodeList controls = document.getElementsByTagNameNS(WORD_NS, "sdt");
            for (int index = 0; index < controls.getLength(); index++) {
                Element control = (Element) controls.item(index);
                NodeList bindings = control.getElementsByTagNameNS(WORD_NS, "dataBinding");
                if (bindings.getLength() == 0) continue;
                Element binding = (Element) bindings.item(0);
                String xpath = binding.getAttributeNS(WORD_NS, "xpath");
                String storeItemId = binding.getAttributeNS(WORD_NS, "storeItemID");
                if (xpath.isBlank() || storeItemId.isBlank()) continue;

                String xpathId = tagValue(control, "od:xpath");
                if (xpathId != null && !xpathId.isBlank()) definitions.putIfAbsent(xpathId, new XpathSpec(storeItemId, xpath));

                String repeatId = tagValue(control, "od:repeat");
                String collectionXpath = inferCollectionXpath(xpath);
                if (repeatId != null && !repeatId.isBlank() && !collectionXpath.isBlank()) {
                    definitions.putIfAbsent(repeatId, new XpathSpec(storeItemId, collectionXpath));
                }
            }
        }
        return definitions;
    }

    private static byte[] addMissingXpaths(byte[] content, Map<String, XpathSpec> definitions) throws Exception {
        Document document = parse(new String(content, StandardCharsets.UTF_8));
        Element root = document.getDocumentElement();
        if (root == null || !OD_XPATH_NS.equals(root.getNamespaceURI()) || !"xpaths".equals(root.getLocalName())) return null;

        Set<String> existing = new LinkedHashSet<>();
        NodeList xpathNodes = document.getElementsByTagNameNS(OD_XPATH_NS, "xpath");
        for (int index = 0; index < xpathNodes.getLength(); index++) {
            existing.add(((Element) xpathNodes.item(index)).getAttribute("id"));
        }

        String prefix = root.getPrefix() == null || root.getPrefix().isBlank() ? "od" : root.getPrefix();
        boolean changed = false;
        for (Map.Entry<String, XpathSpec> entry : definitions.entrySet()) {
            if (existing.contains(entry.getKey())) continue;
            XpathSpec spec = entry.getValue();
            Element xpath = document.createElementNS(OD_XPATH_NS, prefix + ":xpath");
            xpath.setAttribute("id", entry.getKey());
            Element binding = document.createElementNS(OD_XPATH_NS, prefix + ":dataBinding");
            binding.setAttribute("storeItemID", spec.storeItemId());
            binding.setAttribute("xpath", spec.xpath());
            xpath.appendChild(binding);
            root.appendChild(xpath);
            changed = true;
        }
        if (!changed) return null;

        StringWriter serialized = new StringWriter();
        var transformer = TransformerFactory.newInstance().newTransformer();
        transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no");
        transformer.setOutputProperty(OutputKeys.ENCODING, StandardCharsets.UTF_8.name());
        transformer.transform(new DOMSource(document), new StreamResult(serialized));
        return serialized.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String tagValue(Element control, String key) {
        Element tag = firstChild(control, WORD_NS, "tag");
        if (tag == null) return null;
        for (String part : tag.getAttributeNS(WORD_NS, "val").split("&")) {
            int separator = part.indexOf('=');
            if (separator > 0 && key.equals(part.substring(0, separator).trim())) return part.substring(separator + 1).trim();
        }
        return null;
    }

    private static String inferCollectionXpath(String bindingXpath) {
        if (bindingXpath == null || bindingXpath.isBlank()) return "";
        List<String> parts = new ArrayList<>();
        for (String part : bindingXpath.split("/")) {
            if (!part.isBlank()) parts.add(part.trim());
        }
        if (parts.isEmpty()) return "";
        int itemIndex = -1;
        for (int index = 0; index < parts.size(); index++) {
            if ("item".equalsIgnoreCase(parts.get(index).replaceAll("\\[[^]]*\\]", ""))) itemIndex = index;
        }
        if (itemIndex >= 0) parts.set(itemIndex, parts.get(itemIndex).replaceAll("\\[[^]]*\\]", ""));
        int end = itemIndex >= 0 ? itemIndex + 1 : Math.max(1, parts.size() - 1);
        return "/" + String.join("/", parts.subList(0, end));
    }

    private static Element firstChild(Element parent, String namespace, String localName) {
        NodeList children = parent.getElementsByTagNameNS(namespace, localName);
        return children.getLength() == 0 ? null : (Element) children.item(0);
    }

    private static Document parse(String xml) throws Exception {
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

    private record XpathSpec(String storeItemId, String xpath) {
    }
}
