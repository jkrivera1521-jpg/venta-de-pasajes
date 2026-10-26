package com.ventapasajes.report.validation;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

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

    @Test
    void extractsDocxExpressionsSplitAcrossRunsAndMapsLegacyCollections() throws Exception {
        String document = """
                <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                  <w:body>
                    <w:p><w:r><w:t>${</w:t></w:r><w:r><w:t> codigo </w:t></w:r><w:r><w:t>}</w:t></w:r></w:p>
                    <w:p><w:r><w:t>&lt;jt:forEach items = &quot;${ cambios }&quot; var = &quot; cambio &quot;&gt;</w:t></w:r>
                      <w:r><w:t>${ cambio </w:t></w:r><w:r><w:t>.zona }</w:t></w:r>
                      <w:r><w:t>${cambio.fecha}</w:t></w:r>
                      <w:r><w:t>${cambio.autor}</w:t></w:r>
                      <w:r><w:t>${cambio.descripcion}</w:t></w:r>
                      <w:r><w:t>&lt;/jt:forEach&gt;</w:t></w:r></w:p>
                  </w:body>
                </w:document>
                """;

        var result = new TemplateParameterExtractor().extract("docx", docx(document));

        assertTrue(result.stream().anyMatch(value -> value.path().equals("codigo")));
        assertTrue(result.stream().anyMatch(value -> value.path().equals("cambios") && value.collection() && value.repeated()));
        assertTrue(result.stream().anyMatch(value -> value.path().equals("cambios.zona") && value.repeated()));
        assertTrue(result.stream().anyMatch(value -> value.path().equals("cambios.fecha")));
        assertTrue(result.stream().anyMatch(value -> value.path().equals("cambios.autor")));
        assertTrue(result.stream().anyMatch(value -> value.path().equals("cambios.descripcion")));
        assertFalse(result.stream().anyMatch(value -> value.path().startsWith("cambio.")));
    }

    private byte[] docx(String documentXml) throws Exception {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(output)) {
            zip.putNextEntry(new ZipEntry("word/document.xml"));
            zip.write(documentXml.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            return output.toByteArray();
        }
    }
}
