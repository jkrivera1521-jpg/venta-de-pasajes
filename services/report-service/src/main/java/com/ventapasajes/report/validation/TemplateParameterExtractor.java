package com.ventapasajes.report.validation;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;

import org.xml.sax.InputSource;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

import com.ventapasajes.report.domain.ParameterDataType;
import com.ventapasajes.report.domain.ParameterSource;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class TemplateParameterExtractor {
    private static final Pattern EXPRESSION = Pattern.compile("\\$\\{\\s*([A-Za-z_][A-Za-z0-9_]*(?:\\s*\\.\\s*[A-Za-z_][A-Za-z0-9_]*)*)\\s*}");
    private static final Pattern JXLS_ITEMS = Pattern.compile("items\\s*=\\s*[\"']([^\"']+)[\"']");
    private static final Pattern LOOP_DECLARATION = Pattern.compile("(?:<\\s*j[xt]:forEach\\b|j[xt]:each\\s*\\()([^>)]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern ATTRIBUTE = Pattern.compile("([A-Za-z]+)\\s*=\\s*[\\\"']([^\\\"']+)[\\\"']");

    public List<ExtractedParameter> extract(String extension, byte[] content) {
        Map<String, ExtractedParameter> values = new LinkedHashMap<>();
        if ("xlsx".equals(extension)) extractXlsx(content, values);
        else extractDocx(content, values);
        return List.copyOf(values.values());
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

    private void extractDocx(byte[] content, Map<String, ExtractedParameter> values) {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            List<String> texts = new ArrayList<>();
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                if (!entry.getName().startsWith("word/") || !entry.getName().endsWith(".xml")) continue;
                StringBuilder xml = new StringBuilder();
                int read;
                while ((read = zip.read(buffer)) >= 0) xml.append(new String(buffer, 0, read, java.nio.charset.StandardCharsets.UTF_8));
                texts.add(visibleText(xml.toString()));
            }
            List<LoopAlias> aliases = loopAliases(texts);
            texts.forEach(text -> collect(text, false, values, aliases));
        } catch (IOException error) {
            throw new IllegalArgumentException("No se pudo inspeccionar la plantilla DOCX.", error);
        } catch (Exception error) {
            throw new IllegalArgumentException("No se pudo leer el XML de la plantilla DOCX.", error);
        }
    }

    private void collect(String text, boolean repeated, Map<String, ExtractedParameter> values, List<LoopAlias> aliases) {
        Matcher matcher = EXPRESSION.matcher(text == null ? "" : text);
        while (matcher.find()) {
            String rawPath = normalizePath(matcher.group(1));
            LoopAlias alias = aliases.stream()
                    .filter(value -> rawPath.equals(value.variable()) || rawPath.startsWith(value.variable() + "."))
                    .findFirst().orElse(null);
            String path = alias == null ? rawPath : alias.collectionPath() + rawPath.substring(alias.variable().length());
            add(path, repeated || alias != null, values);
        }
        Matcher items = JXLS_ITEMS.matcher(text == null ? "" : text);
        while (items.find()) add(items.group(1), true, values);
    }

    private List<LoopAlias> loopAliases(List<String> texts) {
        Map<String, LoopAlias> aliases = new LinkedHashMap<>();
        texts.forEach(text -> {
            Matcher declaration = LOOP_DECLARATION.matcher(text == null ? "" : text);
            while (declaration.find()) {
                String items = attribute(declaration.group(1), "items");
                String variable = attribute(declaration.group(1), "var");
                String collectionPath = normalizePath(items);
                if (variable != null && !variable.isBlank() && !collectionPath.isBlank()) {
                    aliases.put(variable.trim(), new LoopAlias(variable.trim(), collectionPath));
                }
            }
        });
        return List.copyOf(aliases.values());
    }

    private String visibleText(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        return factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml))).getDocumentElement().getTextContent();
    }

    private void add(String path, boolean repeated, Map<String, ExtractedParameter> values) {
        String normalizedPath = normalizePath(path);
        if (normalizedPath.isBlank()) return;
        String root = normalizedPath.split("\\.", 2)[0];
        ExtractedParameter previous = values.get(normalizedPath);
        if (previous == null) {
            values.put(normalizedPath, new ExtractedParameter(root, normalizedPath, ParameterDataType.UNKNOWN, !normalizedPath.contains("."), repeated, repeated, null, null, ParameterSource.EXTRACTED));
            return;
        }
        if (repeated && (!previous.repeated() || !previous.collection())) {
            values.put(normalizedPath, new ExtractedParameter(previous.name(), previous.path(), previous.dataType(), previous.required(), true, true, previous.defaultValue(), previous.description(), previous.source()));
        }
    }

    private String normalizePath(String path) {
        String value = path == null ? "" : path.trim();
        Matcher expression = EXPRESSION.matcher(value);
        String normalized = expression.matches() ? expression.group(1) : value;
        return normalized.replaceAll("\\s*\\.\\s*", ".").trim();
    }

    private String attribute(String attributes, String name) {
        Matcher matcher = ATTRIBUTE.matcher(attributes == null ? "" : attributes);
        while (matcher.find()) if (matcher.group(1).equalsIgnoreCase(name)) return matcher.group(2).trim();
        return null;
    }

    public record ExtractedParameter(String name, String path, ParameterDataType dataType, boolean required, boolean repeated, boolean collection, Object defaultValue, String description, ParameterSource source) { }
    private record LoopAlias(String variable, String collectionPath) { }
}
