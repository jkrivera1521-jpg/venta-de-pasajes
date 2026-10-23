package com.ventapasajes.report.validation;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class TemplateParameterExtractorTest {
    @Test
    void extractsJxlsExpressionsAndCollections() throws Exception {
        byte[] content;
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Reporte");
            sheet.createRow(0).createCell(0).setCellValue("${cliente.nombre}");
            sheet.createRow(1).createCell(0).setCellValue("${items}");
            workbook.write(output);
            content = output.toByteArray();
        }

        var result = new TemplateParameterExtractor().extract("xlsx", content);
        assertTrue(result.stream().anyMatch(value -> value.path().equals("cliente.nombre")));
        assertTrue(result.stream().anyMatch(value -> value.path().equals("items")));
    }
}
