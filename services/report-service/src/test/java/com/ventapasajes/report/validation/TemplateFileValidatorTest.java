package com.ventapasajes.report.validation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.ByteArrayOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.ventapasajes.report.api.ReportServiceException;

class TemplateFileValidatorTest {
    private TemplateFileValidator validator;

    @BeforeEach
    void setUp() throws Exception {
        validator = new TemplateFileValidator();
        var field = TemplateFileValidator.class.getDeclaredField("maxBytes");
        field.setAccessible(true);
        field.setLong(validator, 1024 * 1024);
    }

    @Test
    void acceptsOfficeOpenXmlExtensionAndSignature() {
        var result = validator.validate("reporte.xlsx", null, officeXlsx());
        assertEquals("xlsx", result.extension());
        assertEquals("XLSX", result.documentType().name());
    }

    @Test
    void rejectsExternalXmlReferences() {
        ReportServiceException error = assertThrows(ReportServiceException.class,
                () -> validator.validate("reporte.docx", null, zip("word/document.xml", "<!DOCTYPE x [<!ENTITY x SYSTEM 'file:///etc/passwd'>]>")));
        assertEquals("TEMPLATE_XML", error.code());
    }

    private byte[] zip(String name, String body) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(output)) {
                zip.putNextEntry(new ZipEntry(name));
                zip.write(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                zip.closeEntry();
            }
            return output.toByteArray();
        } catch (Exception error) {
            throw new AssertionError(error);
        }
    }

    private byte[] officeXlsx() {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(output)) {
                zip.putNextEntry(new ZipEntry("[Content_Types].xml"));
                zip.write("<Types/>".getBytes(java.nio.charset.StandardCharsets.UTF_8));
                zip.closeEntry();
                zip.putNextEntry(new ZipEntry("xl/workbook.xml"));
                zip.write("<workbook/>".getBytes(java.nio.charset.StandardCharsets.UTF_8));
                zip.closeEntry();
            }
            return output.toByteArray();
        } catch (Exception error) {
            throw new AssertionError(error);
        }
    }
}
