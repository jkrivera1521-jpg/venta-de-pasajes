package com.ventapasajes.report.engine;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import java.util.zip.ZipInputStream;

import org.docx4j.openpackaging.packages.WordprocessingMLPackage;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
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

    private String documentXml(byte[] content) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            java.util.zip.ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.getName().equals("word/document.xml")) {
                    return new String(zip.readAllBytes(), StandardCharsets.UTF_8);
                }
            }
        }
        return "";
    }
}
