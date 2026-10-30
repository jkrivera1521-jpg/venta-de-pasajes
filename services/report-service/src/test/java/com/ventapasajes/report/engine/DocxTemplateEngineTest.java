package com.ventapasajes.report.engine;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import java.util.zip.ZipInputStream;

import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.docx4j.XmlUtils;
import org.docx4j.jaxb.Context;
import org.docx4j.openpackaging.parts.PartName;
import org.docx4j.openpackaging.parts.WordprocessingML.FooterPart;
import org.docx4j.openpackaging.parts.WordprocessingML.HeaderPart;
import org.docx4j.openpackaging.packages.WordprocessingMLPackage;
import org.docx4j.relationships.Relationship;
import org.docx4j.wml.FooterReference;
import org.docx4j.wml.Ftr;
import org.docx4j.wml.Hdr;
import org.docx4j.wml.HdrFtrRef;
import org.docx4j.wml.HeaderReference;
import org.docx4j.wml.SectPr;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.report.api.ReportServiceException;
import com.ventapasajes.report.domain.OutputFormat;
import com.ventapasajes.report.persistence.entity.ReportTemplateBlob;
import com.ventapasajes.report.persistence.entity.ReportTemplateVersion;

class DocxTemplateEngineTest {
    @Test
    void loadsAndRendersDocxWithRuntimeStaxProvider() throws Exception {
        ReportTemplateVersion version = templateVersion();

        GeneratedReport generated = new DocxTemplateEngine().generate(
                version,
                new ObjectMapper().readTree("{\"codigo\":\"DOCX_OK\"}"),
                OutputFormat.DOCX,
                "resultado.docx");

        assertTrue(generated.content().length > 0);
        assertTrue(generated.content()[0] == 'P' && generated.content()[1] == 'K');
        assertFalse(documentXml(generated.content()).contains("${codigo}"));
        assertTrue(documentXml(generated.content()).contains("DOCX_OK"));
    }

    @Test
    void rendersDocxAsPdfWithFopConfiguration() throws Exception {
        GeneratedReport generated = new DocxTemplateEngine().generate(
                templateVersion(),
                new ObjectMapper().readTree("{\"codigo\":\"PDF_OK\"}"),
                OutputFormat.PDF,
                "resultado.pdf");

        assertTrue(generated.content().length > 0);
        assertTrue(new String(generated.content(), 0, 5, StandardCharsets.US_ASCII).startsWith("%PDF-"));
    }

    @Test
    void rendersRealOpenDopeTemplateWithNestedDataAndConditionalInputs() throws Exception {
        byte[] fixture;
        try (var input = getClass().getResourceAsStream("/docx4j/invoice-opendope.docx")) {
            fixture = input.readAllBytes();
        }
        GeneratedReport generated = new DocxTemplateEngine().generate(
                templateVersion(fixture),
                new ObjectMapper().readTree("""
                        {
                          "customer": {"name": "Ana Perez"},
                          "items": [
                            {"name": "apples", "price": "$20"},
                            {"name": "bananas", "price": "$30"}
                          ],
                          "misc": {"includeBankDetails": true, "wantspam": false}
                        }
                        """),
                OutputFormat.DOCX,
                "invoice.docx");

        String xml = documentXml(generated.content());
        assertTrue(xml.contains("Ana Perez"));
        assertTrue(xml.contains("apples"));
        assertTrue(xml.contains("bananas"));
    }

    @Test
    void repairsOpenDopeRepeatWhenItsXpathDefinitionIsMissing() throws Exception {
        byte[] fixture = removeXpathDefinition(
                removeXpathDefinition(resource("/docx4j/invoice-opendope.docx"), "x2"),
                "x3");

        GeneratedReport generated = new DocxTemplateEngine().generate(
                templateVersion(fixture),
                new ObjectMapper().readTree("""
                        {
                          "customer": {"name": "Ana Perez"},
                          "items": [
                            {"name": "apples", "price": "$20"},
                            {"name": "bananas", "price": "$30"}
                          ],
                          "misc": {"includeBankDetails": true, "wantspam": false}
                        }
                        """),
                OutputFormat.DOCX,
                "invoice-repaired.docx");

        String xml = documentXml(generated.content());
        assertTrue(xml.contains("Ana Perez"));
        assertTrue(xml.contains("apples"));
        assertTrue(xml.contains("bananas"));
    }

    @Test
    void replacesVariablesInHeadersAndFooters() throws Exception {
        WordprocessingMLPackage source = WordprocessingMLPackage.createPackage();
        HeaderPart header = new HeaderPart(new PartName("/word/header1.xml"));
        header.setPackage(source);
        header.setJaxbElement((Hdr) XmlUtils.unmarshalString("""
                <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                  <w:p><w:r><w:t>${headerCode}</w:t></w:r></w:p>
                </w:hdr>
                """, Context.jc, Hdr.class));
        Relationship headerRelationship = source.getMainDocumentPart().addTargetPart(header);

        FooterPart footer = new FooterPart(new PartName("/word/footer1.xml"));
        footer.setPackage(source);
        footer.setJaxbElement((Ftr) XmlUtils.unmarshalString("""
                <w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                  <w:p><w:r><w:t>${footerCode}</w:t></w:r></w:p>
                </w:ftr>
                """, Context.jc, Ftr.class));
        Relationship footerRelationship = source.getMainDocumentPart().addTargetPart(footer);

        SectPr section = source.getMainDocumentPart().getJaxbElement().getBody().getSectPr();
        if (section == null) {
            section = Context.getWmlObjectFactory().createSectPr();
            source.getMainDocumentPart().getJaxbElement().getBody().setSectPr(section);
        }
        HeaderReference headerReference = Context.getWmlObjectFactory().createHeaderReference();
        headerReference.setId(headerRelationship.getId());
        headerReference.setType(HdrFtrRef.DEFAULT);
        section.getEGHdrFtrReferences().add(headerReference);
        FooterReference footerReference = Context.getWmlObjectFactory().createFooterReference();
        footerReference.setId(footerRelationship.getId());
        footerReference.setType(HdrFtrRef.DEFAULT);
        section.getEGHdrFtrReferences().add(footerReference);

        ByteArrayOutputStream sourceBytes = new ByteArrayOutputStream();
        source.save(sourceBytes);
        GeneratedReport generated = new DocxTemplateEngine().generate(
                templateVersion(sourceBytes.toByteArray()),
                new ObjectMapper().readTree("{\"headerCode\":\"HEADER_OK\",\"footerCode\":\"FOOTER_OK\"}"),
                OutputFormat.DOCX,
                "header-footer.docx");

        assertTrue(partXml(generated.content(), "word/header1.xml").contains("HEADER_OK"));
        assertTrue(partXml(generated.content(), "word/footer1.xml").contains("FOOTER_OK"));
    }

    @Test
    void replacesMergeFieldsFromDocx4jFixture() throws Exception {
        byte[] fixture;
        try (var input = getClass().getResourceAsStream("/docx4j/MERGEFIELD.docx")) {
            fixture = input.readAllBytes();
        }
        GeneratedReport generated = new DocxTemplateEngine().generate(
                templateVersion(fixture),
                new ObjectMapper().readTree("{\"kundenname\":\"Maria\",\"Kundenname\":\"Maria\"}"),
                OutputFormat.DOCX,
                "mergefield.docx");

        String xml = documentXml(generated.content());
        assertTrue(xml.contains("Maria"));
        assertFalse(xml.contains("«Kundenname»"));
    }

    @Test
    void bindsDynamicImageFromBase64AndExportsPdf() throws Exception {
        String imageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
        byte[] image = Base64.getDecoder().decode(imageBase64);
        GeneratedReport generated = new DocxTemplateEngine().generate(
                templateVersion(resource("/docx4j/picture.docx")),
                new ObjectMapper().createObjectNode().put("element1", imageBase64).put("element2", "IMAGE_OK"),
                OutputFormat.DOCX,
                "picture.docx");

        assertTrue(partXml(generated.content(), "word/document.xml").contains("r:embed"));
        assertTrue(zipContainsEntry(generated.content(), "word/media/", image));

        GeneratedReport pdf = new DocxTemplateEngine().generate(
                templateVersion(resource("/docx4j/picture.docx")),
                new ObjectMapper().createObjectNode().put("element1", imageBase64).put("element2", "IMAGE_OK"),
                OutputFormat.PDF,
                "picture.pdf");
        assertTrue(new String(pdf.content(), 0, 5, StandardCharsets.US_ASCII).startsWith("%PDF-"));
    }

    @Test
    void updatesChartCachesAndEmbeddedWorkbook() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        var parameters = mapper.createObjectNode();
        var chart = parameters.putObject("charts").putObject("chart1");
        chart.putArray("categories").add("North").add("South").add("East").add("West");
        var series = chart.putArray("series");
        series.addObject().put("name", "2026").putArray("values").add(10.0).add(20.0).add(30.0).add(40.0);
        series.addObject().put("name", "2027").putArray("values").add(12.0).add(22.0).add(32.0).add(42.0);
        series.addObject().put("name", "2028").putArray("values").add(14.0).add(24.0).add(34.0).add(44.0);

        GeneratedReport generated = new DocxTemplateEngine().generate(
                templateVersion(resource("/docx4j/clustered-column.docx")), parameters, OutputFormat.DOCX, "chart.docx");

        String chartXml = partXml(generated.content(), "word/charts/chart1.xml");
        assertTrue(chartXml.contains("North") && chartXml.contains("2026") && chartXml.contains("40"));
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(zipEntry(generated.content(), "word/embeddings/Microsoft_Excel_Worksheet.xlsx")))) {
            assertTrue(workbook.getSheetAt(0).getRow(1).getCell(0).getStringCellValue().equals("North"));
            assertTrue(workbook.getSheetAt(0).getRow(0).getCell(1).getStringCellValue().equals("2026"));
            assertTrue(workbook.getSheetAt(0).getRow(4).getCell(3).getNumericCellValue() == 44.0);
        }
    }

    @Test
    void rejectsChartWithMismatchedSeriesCount() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        var parameters = mapper.createObjectNode();
        var chart = parameters.putObject("charts").putObject("chart1");
        chart.putArray("categories").add("North").add("South").add("East").add("West");
        chart.putArray("series").addObject().put("name", "2026").putArray("values").add(10).add(20).add(30).add(40);

        ReportServiceException error = assertThrows(ReportServiceException.class, () -> new DocxTemplateEngine().generate(
                templateVersion(resource("/docx4j/clustered-column.docx")), parameters, OutputFormat.DOCX, "invalid-chart.docx"));

        assertEquals("INVALID_CHART_DATA", error.code());
    }

    @Test
    void preservesBookmarksAndRendersTocFixtureAsPdf() throws Exception {
        byte[] fixture = resource("/docx4j/toc.docx");
        GeneratedReport generated = new DocxTemplateEngine().generate(
                templateVersion(fixture),
                new ObjectMapper().createObjectNode(),
                OutputFormat.DOCX,
                "toc.docx");

        String xml = documentXml(generated.content());
        assertTrue(xml.contains("bookmarkStart"));
        assertTrue(xml.contains("bookmarkEnd"));

        GeneratedReport pdf = new DocxTemplateEngine().generate(
                templateVersion(fixture),
                new ObjectMapper().createObjectNode(),
                OutputFormat.PDF,
                "toc.pdf");
        assertTrue(new String(pdf.content(), 0, 5, StandardCharsets.US_ASCII).startsWith("%PDF-"));
    }

    @Test
    void sanitizesAndRendersRichTextContentControl() throws Exception {
        byte[] fixture = replacePart(resource("/docx4j/picture.docx"), "word/document.xml", "w:picture", "w:richText");
        GeneratedReport generated = new DocxTemplateEngine().generate(
                templateVersion(fixture),
                new ObjectMapper().createObjectNode().put("element1", "<p><strong>Rich</strong> <em>text</em><br/><u>OK</u></p>"),
                OutputFormat.DOCX,
                "rich-text.docx");

        String xml = documentXml(generated.content());
        assertTrue(xml.contains("Rich"));
        assertTrue(xml.contains("<w:b"));
        assertTrue(xml.contains("<w:i"));
        assertTrue(xml.contains("<w:u"));
        assertFalse(xml.contains("&lt;p&gt;"));
        assertFalse(xml.contains("&lt;strong&gt;"));
        assertFalse(xml.contains("&lt;em&gt;"));
    }

    private ReportTemplateVersion templateVersion() throws Exception {
        WordprocessingMLPackage source = WordprocessingMLPackage.createPackage();
        source.getMainDocumentPart().addParagraphOfText("${codigo}");
        ByteArrayOutputStream sourceBytes = new ByteArrayOutputStream();
        source.save(sourceBytes);

        ReportTemplateVersion version = new ReportTemplateVersion();
        version.id = UUID.randomUUID();
        version.version = 1;
        version.fileName = "plantilla.docx";
        version.contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        version.fileExtension = "docx";
        version.fileSize = (long) sourceBytes.size();
        version.checksumSha256 = "test";
        version.createdBy = "test";
        version.createdAt = Instant.now();
        version.blob = new ReportTemplateBlob();
        version.blob.content = sourceBytes.toByteArray();
        return version;
    }

    private ReportTemplateVersion templateVersion(byte[] content) {
        ReportTemplateVersion version = new ReportTemplateVersion();
        version.id = UUID.randomUUID();
        version.version = 1;
        version.fileName = "invoice.docx";
        version.contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        version.fileExtension = "docx";
        version.fileSize = (long) content.length;
        version.checksumSha256 = "test-opendope";
        version.createdBy = "test";
        version.createdAt = Instant.now();
        version.blob = new ReportTemplateBlob();
        version.blob.content = content;
        return version;
    }

    private String documentXml(byte[] content) throws Exception {
        return partXml(content, "word/document.xml");
    }

    private byte[] resource(String name) throws Exception {
        try (var input = getClass().getResourceAsStream(name)) {
            return input.readAllBytes();
        }
    }

    private boolean zipContainsEntry(byte[] content, String prefix, byte[] expected) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            java.util.zip.ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.getName().startsWith(prefix) && java.util.Arrays.equals(expected, zip.readAllBytes())) return true;
            }
        }
        return false;
    }

    private byte[] replacePart(byte[] content, String partName, String from, String to) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(content));
                java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(output)) {
            java.util.zip.ZipEntry entry;
            while ((entry = input.getNextEntry()) != null) {
                zip.putNextEntry(new java.util.zip.ZipEntry(entry.getName()));
                byte[] bytes = input.readAllBytes();
                if (entry.getName().equals(partName)) {
                    bytes = new String(bytes, StandardCharsets.UTF_8).replace(from, to).getBytes(StandardCharsets.UTF_8);
                }
                zip.write(bytes);
                zip.closeEntry();
            }
        }
        return output.toByteArray();
    }

    private byte[] removeXpathDefinition(byte[] content, String id) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(content));
                java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(output)) {
            java.util.zip.ZipEntry entry;
            while ((entry = input.getNextEntry()) != null) {
                zip.putNextEntry(new java.util.zip.ZipEntry(entry.getName()));
                byte[] bytes = input.readAllBytes();
                if (entry.getName().equals("customXml/item4.xml")) {
                    String xml = new String(bytes, StandardCharsets.UTF_8);
                    xml = xml.replaceFirst("(?s)<[^:>]+:xpath id=\"" + id + "\">.*?</[^:>]+:xpath>", "");
                    bytes = xml.getBytes(StandardCharsets.UTF_8);
                }
                zip.write(bytes);
                zip.closeEntry();
            }
        }
        return output.toByteArray();
    }

    private String partXml(byte[] content, String partName) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            java.util.zip.ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.getName().equals(partName)) {
                    return new String(zip.readAllBytes(), StandardCharsets.UTF_8);
                }
            }
        }
        return "";
    }

    private byte[] zipEntry(byte[] content, String entryName) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            java.util.zip.ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.getName().equals(entryName)) {
                    return zip.readAllBytes();
                }
            }
        }
        throw new IllegalArgumentException("Falta la entrada ZIP: " + entryName);
    }
}
