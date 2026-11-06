package com.ventapasajes.report.engine;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import jakarta.xml.bind.JAXBElement;
import org.docx4j.TraversalUtil;
import org.docx4j.jaxb.Context;
import org.docx4j.openpackaging.parts.JaxbXmlPart;
import org.docx4j.openpackaging.parts.Part;
import org.docx4j.openpackaging.parts.WordprocessingML.FooterPart;
import org.docx4j.openpackaging.parts.WordprocessingML.HeaderPart;
import org.docx4j.openpackaging.parts.WordprocessingML.MainDocumentPart;
import org.docx4j.openpackaging.packages.WordprocessingMLPackage;
import org.docx4j.wml.Br;
import org.docx4j.wml.BooleanDefaultTrue;
import org.docx4j.wml.CTSdtContentRun;
import org.docx4j.wml.R;
import org.docx4j.wml.RPr;
import org.docx4j.wml.SdtBlock;
import org.docx4j.wml.SdtElement;
import org.docx4j.wml.SdtPr;
import org.docx4j.wml.SdtRun;
import org.docx4j.wml.SdtContentBlock;
import org.docx4j.wml.Text;
import org.docx4j.wml.U;
import org.docx4j.wml.UnderlineEnumeration;
import org.docx4j.wml.P;

import com.fasterxml.jackson.databind.JsonNode;
import com.ventapasajes.report.validation.RichTextSanitizer;

/** Renders the safe rich-text subset into native WordprocessingML. */
public class RichTextTemplateProcessor {
    private static final Pattern XPATH_SEGMENT = Pattern.compile("^([^\\[]+)(?:\\[(\\d+)\\])?.*$");
    private final RichTextSanitizer sanitizer;
    private final org.docx4j.wml.ObjectFactory factory = Context.getWmlObjectFactory();

    public RichTextTemplateProcessor() {
        this(new RichTextSanitizer());
    }

    RichTextTemplateProcessor(RichTextSanitizer sanitizer) {
        this.sanitizer = sanitizer;
    }

    public void apply(WordprocessingMLPackage document, JsonNode parameters) {
        for (Part part : document.getParts().getParts().values()) {
            if (!(part instanceof JaxbXmlPart<?> xmlPart)) continue;
            if (!(part instanceof MainDocumentPart || part instanceof HeaderPart || part instanceof FooterPart)) continue;
            TraversalUtil.visit(xmlPart.getJaxbElement(), new TraversalUtil.CallbackImpl() {
                @Override
                public List<Object> apply(Object element) {
                    if (element instanceof SdtElement sdt && isRichText(sdt)) {
                        render(sdt, valueFor(sdt, parameters));
                        // The rich content is now materialized as WordprocessingML. Detach only
                        // this control so the later scalar OpenDoPE binding cannot replace it.
                        sdt.getSdtPr().setDataBinding(null);
                        return null;
                    }
                    return null;
                }
            });
        }
    }

    private boolean isRichText(SdtElement element) {
        return element.getSdtPr() != null
                && element.getSdtPr().getDataBinding() != null
                && element.getSdtPr().getRPrOrAliasOrLock().stream().anyMatch(value -> {
                    if (value instanceof SdtPr.RichText) return true;
                    return value instanceof JAXBElement<?> jaxb
                            && "richText".equals(jaxb.getName().getLocalPart());
                });
    }

    private String valueFor(SdtElement element, JsonNode parameters) {
        List<PathSegment> path = jsonPath(element.getSdtPr().getDataBinding().getXpath());
        JsonNode value = atPath(parameters, path, 0);
        if (value == null || value.isMissingNode() || value.isNull()) return "";
        if (value.isObject() && value.has("html")) value = value.get("html");
        if (!value.isTextual()) throw new IllegalArgumentException("El parametro de texto enriquecido debe ser texto: " + pathString(path));
        return sanitizer.sanitize(value.asText());
    }

    /** Resolves docx4j XPath bindings, including item[n] inside nested arrays. */
    private JsonNode atPath(JsonNode current, List<PathSegment> path, int index) {
        if (current == null) return com.fasterxml.jackson.databind.node.MissingNode.getInstance();
        if (index >= path.size()) return current;
        PathSegment segment = path.get(index);
        if (current.isArray()) {
            int itemIndex = segment.index() == null ? 0 : Math.max(0, segment.index() - 1);
            if (itemIndex < current.size()) {
                return atPath(current.get(itemIndex), path, "item".equals(segment.name()) ? index + 1 : index);
            }
            return com.fasterxml.jackson.databind.node.MissingNode.getInstance();
        }
        if (!current.isObject()) return com.fasterxml.jackson.databind.node.MissingNode.getInstance();
        JsonNode child = current.get(segment.name());
        if (child == null) return com.fasterxml.jackson.databind.node.MissingNode.getInstance();
        return atPath(child, path, index + 1);
    }

    private List<PathSegment> jsonPath(String xpath) {
        if (xpath == null || xpath.isBlank()) return List.of();
        List<PathSegment> parts = new ArrayList<>();
        for (String raw : xpath.split("/")) {
            String part = raw.trim();
            if (part.isBlank()) continue;
            Matcher matcher = XPATH_SEGMENT.matcher(part);
            if (!matcher.matches()) continue;
            String name = matcher.group(1).contains(":")
                    ? matcher.group(1).substring(matcher.group(1).indexOf(':') + 1)
                    : matcher.group(1);
            Integer itemIndex = matcher.group(2) == null ? null : Integer.valueOf(matcher.group(2));
            parts.add(new PathSegment(name, itemIndex));
        }
        if (parts.size() > 1) parts.remove(0);
        return parts;
    }

    private String pathString(List<PathSegment> path) {
        return path.stream().map(segment -> segment.name() + (segment.index() == null ? "" : "[" + segment.index() + "]"))
                .reduce((left, right) -> left + "." + right).orElse("");
    }

    private void render(SdtElement element, String html) {
        org.jsoup.nodes.Document parsed = org.jsoup.Jsoup.parseBodyFragment(html, "");
        if (element instanceof SdtBlock block && block.getSdtContent() instanceof SdtContentBlock content) {
            content.getContent().clear();
            content.getContent().addAll(renderParagraphs(parsed.body()));
        } else if (element instanceof SdtRun run && run.getSdtContent() instanceof CTSdtContentRun content) {
            content.getContent().clear();
            List<P> paragraphs = renderParagraphs(parsed.body());
            for (int index = 0; index < paragraphs.size(); index++) {
                if (index > 0) content.getContent().add(factory.createBr());
                content.getContent().addAll(paragraphs.get(index).getContent());
            }
        }
    }

    private List<P> renderParagraphs(org.jsoup.nodes.Element body) {
        List<P> result = new ArrayList<>();
        P inline = null;
        for (org.jsoup.nodes.Node node : body.childNodes()) {
            if (node instanceof org.jsoup.nodes.Element element) {
                switch (element.tagName()) {
                    case "p" -> result.add(renderParagraph(element, ""));
                    case "ul", "ol" -> addList(result, element);
                    case "br" -> {
                        if (inline == null) inline = factory.createP();
                        inline.getContent().add(factory.createBr());
                    }
                    default -> {
                        if (inline == null) inline = factory.createP();
                        renderInline(element, inline, new Style(false, false, false));
                    }
                }
            } else if (node instanceof org.jsoup.nodes.TextNode text) {
                if (!text.text().isBlank()) {
                    if (inline == null) inline = factory.createP();
                    addText(inline, text.text(), new Style(false, false, false));
                }
            }
        }
        if (inline != null) result.add(inline);
        if (result.isEmpty()) result.add(factory.createP());
        return result;
    }

    private void addList(List<P> paragraphs, org.jsoup.nodes.Element list) {
        int index = 1;
        for (org.jsoup.nodes.Element item : list.children()) {
            if (!item.tagName().equals("li")) continue;
            P paragraph = renderParagraph(item, list.tagName().equals("ol") ? index++ + ". " : "- ");
            paragraphs.add(paragraph);
        }
    }

    private P renderParagraph(org.jsoup.nodes.Element element, String prefix) {
        P paragraph = factory.createP();
        if (!prefix.isBlank()) addText(paragraph, prefix, new Style(false, false, false));
        for (org.jsoup.nodes.Node child : element.childNodes()) {
            if (child instanceof org.jsoup.nodes.Element nested && (nested.tagName().equals("ul") || nested.tagName().equals("ol"))) continue;
            renderInline(child, paragraph, new Style(false, false, false));
        }
        return paragraph;
    }

    private void renderInline(org.jsoup.nodes.Node node, P paragraph, Style style) {
        if (node instanceof org.jsoup.nodes.TextNode text) {
            addText(paragraph, text.text(), style);
            return;
        }
        if (!(node instanceof org.jsoup.nodes.Element element)) return;
        if (element.tagName().equals("br")) {
            paragraph.getContent().add(factory.createBr());
            return;
        }
        Style nested = new Style(
                style.bold() || element.tagName().equals("strong"),
                style.italic() || element.tagName().equals("em"),
                style.underline() || element.tagName().equals("u"));
        for (org.jsoup.nodes.Node child : element.childNodes()) renderInline(child, paragraph, nested);
    }

    private void addText(P paragraph, String value, Style style) {
        if (value == null || value.isEmpty()) return;
        String[] lines = value.replace("\r\n", "\n").replace('\r', '\n').split("\n", -1);
        for (int index = 0; index < lines.length; index++) {
            if (index > 0) paragraph.getContent().add(factory.createBr());
            R run = factory.createR();
            if (style.bold() || style.italic() || style.underline()) {
                RPr properties = factory.createRPr();
                if (style.bold()) properties.setB(new BooleanDefaultTrue());
                if (style.italic()) properties.setI(new BooleanDefaultTrue());
                if (style.underline()) {
                    U underline = factory.createU();
                    underline.setVal(UnderlineEnumeration.SINGLE);
                    properties.setU(underline);
                }
                run.setRPr(properties);
            }
            Text text = factory.createText();
            text.setValue(lines[index]);
            if (lines[index].startsWith(" ") || lines[index].endsWith(" ")) text.setSpace("preserve");
            run.getContent().add(text);
            paragraph.getContent().add(run);
        }
    }

    private record Style(boolean bold, boolean italic, boolean underline) {
    }

    private record PathSegment(String name, Integer index) {
    }
}
