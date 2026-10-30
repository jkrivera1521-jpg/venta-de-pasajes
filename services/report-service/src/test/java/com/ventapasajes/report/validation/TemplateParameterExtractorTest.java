package com.ventapasajes.report.validation;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import com.ventapasajes.report.domain.ParameterDataType;
import com.ventapasajes.report.domain.TemplateEngineType;
import com.ventapasajes.report.domain.TemplateFeature;

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

    @Test
    void inspectsRealOpenDopeTemplateAndMapsXpathToJsonPaths() throws Exception {
        byte[] content;
        try (var input = getClass().getResourceAsStream("/docx4j/invoice-opendope.docx")) {
            content = input.readAllBytes();
        }

        var inspection = new TemplateParameterExtractor().inspect("docx", content);

        assertTrue(inspection.metadata().engine() == TemplateEngineType.OPENDOPE);
        assertTrue(inspection.metadata().features().contains(TemplateFeature.CONTENT_CONTROLS));
        assertTrue(inspection.metadata().features().contains(TemplateFeature.REPEATS));
        assertTrue(inspection.metadata().features().contains(TemplateFeature.CONDITIONALS));
        assertTrue(inspection.metadata().features().contains(TemplateFeature.JSON_XML_BINDING));
        assertTrue("invoice".equals(inspection.metadata().xmlRoot()));
        assertTrue(inspection.parameters().stream().anyMatch(value -> value.path().equals("customer.name")));
        assertTrue(inspection.parameters().stream().anyMatch(value -> value.path().equals("items") && value.collection()));
        assertTrue(inspection.parameters().stream().anyMatch(value -> value.path().equals("items.name") && value.repeated()));
        assertTrue(inspection.parameters().stream().anyMatch(value -> value.path().equals("misc.includeBankDetails") && value.dataType().name().equals("BOOLEAN")));
    }

    @Test
    void detectsDynamicImageBindingFromRealFixture() throws Exception {
        var inspection = new TemplateParameterExtractor().inspect("docx", resource("/docx4j/picture.docx"));

        assertTrue(inspection.metadata().features().contains(TemplateFeature.IMAGES));
        assertTrue(inspection.parameters().stream().anyMatch(value -> value.path().equals("element1") && value.dataType() == ParameterDataType.IMAGE));
    }

    @Test
    void detectsTocAndBookmarksAndReportsDuplicateNames() throws Exception {
        var inspection = new TemplateParameterExtractor().inspect("docx", resource("/docx4j/toc.docx"));

        assertTrue(inspection.metadata().features().contains(TemplateFeature.TOC_BOOKMARKS));
        assertTrue(inspection.metadata().warnings().stream().noneMatch(value -> value.contains("TOC")));
    }

    @Test
    void exposesChartsAsOptionalStructuredParameter() throws Exception {
        var inspection = new TemplateParameterExtractor().inspect("docx", resource("/docx4j/clustered-column.docx"));

        assertTrue(inspection.metadata().features().contains(TemplateFeature.CHARTS));
        assertTrue(inspection.parameters().stream().anyMatch(value -> value.path().equals("charts")
                && value.dataType() == ParameterDataType.OBJECT && !value.required()));
    }

    private byte[] resource(String name) throws Exception {
        try (var input = getClass().getResourceAsStream(name)) {
            return input.readAllBytes();
        }
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
