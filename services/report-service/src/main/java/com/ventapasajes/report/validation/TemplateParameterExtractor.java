package com.ventapasajes.report.validation;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

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
    private static final Pattern EXPRESSION = Pattern.compile("\\$\\{\\s*([A-Za-z_][A-Za-z0-9_.]*)\\s*}");
    private static final Pattern JXLS_ITEMS = Pattern.compile("items\\s*=\\s*[\"']([^\"']+)[\"']");

    public List<ExtractedParameter> extract(String extension, byte[] content) {
        Map<String, ExtractedParameter> values = new LinkedHashMap<>();
        if ("xlsx".equals(extension)) extractXlsx(content, values);
        else extractDocx(content, values);
        return List.copyOf(values.values());
    }

    private void extractXlsx(byte[] content, Map<String, ExtractedParameter> values) {
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            for (Sheet sheet : workbook) for (Row row : sheet) for (Cell cell : row) {
                if (cell.getCellType() == CellType.STRING) collect(cell.getStringCellValue(), false, values);
                if (cell.getCellComment() != null) collect(cell.getCellComment().getString().getString().concat(" ").concat(cell.getCellComment().getAuthor()), false, values);
            }
        } catch (Exception error) {
            throw new IllegalArgumentException("No se pudo inspeccionar la plantilla XLSX.", error);
        }
    }

    private void extractDocx(byte[] content, Map<String, ExtractedParameter> values) {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                if (!entry.getName().startsWith("word/") || !entry.getName().endsWith(".xml")) continue;
                StringBuilder xml = new StringBuilder();
                int read;
                while ((read = zip.read(buffer)) >= 0) xml.append(new String(buffer, 0, read, java.nio.charset.StandardCharsets.UTF_8));
                collect(xml.toString(), false, values);
            }
        } catch (IOException error) {
            throw new IllegalArgumentException("No se pudo inspeccionar la plantilla DOCX.", error);
        }
    }

    private void collect(String text, boolean repeated, Map<String, ExtractedParameter> values) {
        Matcher matcher = EXPRESSION.matcher(text == null ? "" : text);
        while (matcher.find()) add(matcher.group(1), repeated, values);
        Matcher items = JXLS_ITEMS.matcher(text == null ? "" : text);
        while (items.find()) add(items.group(1), true, values);
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
        return expression.matches() ? expression.group(1) : value;
    }

    public record ExtractedParameter(String name, String path, ParameterDataType dataType, boolean required, boolean repeated, boolean collection, Object defaultValue, String description, ParameterSource source) { }
}
