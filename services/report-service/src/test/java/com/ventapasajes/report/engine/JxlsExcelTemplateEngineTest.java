package com.ventapasajes.report.engine;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.report.domain.OutputFormat;
import com.ventapasajes.report.persistence.entity.ReportTemplateBlob;
import com.ventapasajes.report.persistence.entity.ReportTemplateVersion;

class JxlsExcelTemplateEngineTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void rendersLegacyForEachTemplateWithValuesAndRepeatedRows() throws Exception {
        byte[] template = legacyTemplate();
        try (Workbook adapted = WorkbookFactory.create(new ByteArrayInputStream(LegacyJxlsTemplateAdapter.adapt(template)))) {
            var comment = adapted.getSheetAt(0).getRow(0).getCell(0).getCellComment();
            assertNotNull(comment);
            assertTrue(comment.getString().getString().contains("jx:area"));
            var scalarComment = adapted.getSheet("Indicadores").getRow(0).getCell(1).getCellComment();
            assertNotNull(scalarComment);
            assertTrue(scalarComment.getString().getString().contains("jx:area"));
        }

        ReportTemplateVersion version = new ReportTemplateVersion();
        version.id = UUID.randomUUID();
        version.blob = new ReportTemplateBlob();
        version.blob.content = template;

        var parameters = mapper.valueToTree(Map.of(
                "fechaInicio", "2026-10-01",
                "indicador", "80%",
                "atenciones", List.of(
                        Map.of("provincia", "Pichincha", "tramite", "Afiliacion"),
                        Map.of("provincia", "Guayas", "tramite", "Prestacion"))));

        GeneratedReport result = new JxlsExcelTemplateEngine().generate(version, parameters, OutputFormat.XLSX, "reporte.xlsx");

        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(result.content()))) {
            var sheet = workbook.getSheetAt(0);
            assertEquals("Fecha: 2026-10-01", sheet.getRow(0).getCell(0).getStringCellValue());
            assertEquals("Pichincha", sheet.getRow(1).getCell(1).getStringCellValue());
            assertEquals("Afiliacion", sheet.getRow(1).getCell(2).getStringCellValue());
            assertEquals("Guayas", sheet.getRow(2).getCell(1).getStringCellValue());
            assertEquals("Prestacion", sheet.getRow(2).getCell(2).getStringCellValue());
            assertTrue(workbook.getPrintArea(0).contains("$C$3"));
            assertTrue(sheet.getMergedRegions().stream().anyMatch(region ->
                    region.getFirstRow() == 0 && region.getLastRow() == 0
                            && region.getFirstColumn() == 3 && region.getLastColumn() == 5));
            assertEquals("80%", workbook.getSheet("Indicadores").getRow(1).getCell(1).getStringCellValue());
        }
    }

    private byte[] legacyTemplate() throws Exception {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Datos");
            sheet.createRow(0).createCell(0).setCellValue("Fecha: ${fechaInicio}");
            sheet.getRow(0).createCell(3).setCellValue("Titulo");
            sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 3, 5));
            workbook.setPrintArea(0, 0, 2, 0, 1);
            Row row = sheet.createRow(1);
            row.createCell(0).setCellValue("<jt:forEach items=\"${atenciones}\" var=\"atencion\">");
            row.createCell(1).setCellValue("${atencion.provincia}");
            row.createCell(2).setCellValue("${atencion.tramite}</jt:forEach>");
            var indicators = workbook.createSheet("Indicadores");
            indicators.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 1, 3));
            indicators.createRow(0).createCell(1).setCellValue("Indicador");
            indicators.createRow(1).createCell(1).setCellValue("${indicador}");
            workbook.write(output);
            return output.toByteArray();
        }
    }
}
