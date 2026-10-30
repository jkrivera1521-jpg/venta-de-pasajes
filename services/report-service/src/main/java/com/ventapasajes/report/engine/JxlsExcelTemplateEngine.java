package com.ventapasajes.report.engine;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.ventapasajes.report.api.ReportServiceException;
import com.ventapasajes.report.domain.OutputFormat;
import com.ventapasajes.report.persistence.entity.ReportTemplateVersion;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.poi.ss.usermodel.Name;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.AreaReference;
import org.jboss.logging.Logger;
import org.jxls.builder.JxlsStreaming;
import org.jxls.transform.poi.JxlsPoi;

@ApplicationScoped
public class JxlsExcelTemplateEngine implements TemplateEngine {
    private static final Logger LOG = Logger.getLogger(JxlsExcelTemplateEngine.class);

    @Override
    public GeneratedReport generate(ReportTemplateVersion template, JsonNode parameters, OutputFormat format, String fileName) {
        if (format != OutputFormat.XLSX) throw new ReportServiceException(422, "UNSUPPORTED_OUTPUT_FORMAT", "Una plantilla XLSX solo puede generar XLSX.");
        byte[] adaptedContent = LegacyJxlsTemplateAdapter.adapt(template.blob.content);
        try (InputStream input = new ByteArrayInputStream(adaptedContent); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Map<String, Object> variables = new LinkedHashMap<>();
            if (parameters != null && parameters.isObject()) {
                var fields = parameters.fields();
                while (fields.hasNext()) {
                    var field = fields.next();
                    variables.put(field.getKey(), jsonValue(field.getValue()));
                }
            }
            JxlsPoi.fill(input, JxlsStreaming.AUTO_DETECT, variables, output);
            byte[] content = expandPrintAreas(output.toByteArray());
            return new GeneratedReport(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        } catch (Exception error) {
            LOG.error("No se pudo procesar la plantilla XLSX con JXLS.", error);
            throw new ReportServiceException(422, "TEMPLATE_RENDER_FAILED", "No se pudo procesar la plantilla XLSX con JXLS.");
        }
    }

    private byte[] expandPrintAreas(byte[] content) throws Exception {
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content));
                ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            for (int index = 0; index < workbook.getNumberOfSheets(); index++) {
                Sheet sheet = workbook.getSheetAt(index);
                String printArea = workbook.getPrintArea(index);
                if (printArea == null || printArea.isBlank() || !AreaReference.isContiguous(printArea)) continue;

                String range = printArea.substring(printArea.lastIndexOf('!') + 1);
                AreaReference originalArea = new AreaReference(range, workbook.getSpreadsheetVersion());
                int lastRow = Math.max(originalArea.getLastCell().getRow(), sheet.getLastRowNum());
                workbook.setPrintArea(index, originalArea.getFirstCell().getCol(), originalArea.getLastCell().getCol(),
                        originalArea.getFirstCell().getRow(), lastRow);
                updatePrintAreaAliases(workbook, sheet, originalArea, lastRow);
            }
            workbook.write(output);
            return output.toByteArray();
        }
    }

    private void updatePrintAreaAliases(Workbook workbook, Sheet sheet, AreaReference originalArea, int lastRow) {
        String sheetName = sheet.getSheetName().replace("'", "''");
        String formula = "'" + sheetName + "'!$" + columnName(originalArea.getFirstCell().getCol()) + "$"
                + (originalArea.getFirstCell().getRow() + 1) + ":$" + columnName(originalArea.getLastCell().getCol()) + "$"
                + (lastRow + 1);
        for (Name name : workbook.getAllNames()) {
            if (name.getSheetName() == null || !name.getSheetName().equals(sheet.getSheetName())) continue;
            String nameValue = name.getNameName();
            if ("_xlnm.Print_Area".equalsIgnoreCase(nameValue) || "Excel_BuiltIn_Print_Area".equalsIgnoreCase(nameValue)) {
                name.setRefersToFormula(formula);
            }
        }
    }

    private String columnName(int zeroBasedColumn) {
        int value = Math.max(0, zeroBasedColumn) + 1;
        StringBuilder result = new StringBuilder();
        while (value > 0) {
            int remainder = (value - 1) % 26;
            result.append((char) ('A' + remainder));
            value = (value - 1) / 26;
        }
        return result.reverse().toString();
    }

    private Object jsonValue(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isTextual()) return node.textValue();
        if (node.isBoolean()) return node.booleanValue();
        if (node.isIntegralNumber()) return node.longValue();
        if (node.isFloatingPointNumber()) return node.doubleValue();
        if (node.isArray()) return node.valueStream().map(this::jsonValue).toList();
        if (node.isObject()) {
            Map<String, Object> values = new java.util.LinkedHashMap<>();
            node.fields().forEachRemaining(field -> values.put(field.getKey(), jsonValue(field.getValue())));
            return values;
        }
        return node.asText();
    }
}
