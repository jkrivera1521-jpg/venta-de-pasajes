package com.ventapasajes.report.engine;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

class LegacyDocxTemplateAdapterTest {
    @Test
    void expandsLegacyTableRowsForEachChange() throws Exception {
        String document = """
                <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                  <w:body><w:tbl><w:tr>
                    <w:tc><w:p><w:r><w:t>&lt;jt:forEach items=&quot;${ cambios }&quot; var=&quot;cambio&quot;&gt;${cambio.zona}</w:t></w:r></w:p></w:tc>
                    <w:tc><w:p><w:r><w:t>${cambio.descripcion}&lt;/jt:forEach&gt;</w:t></w:r></w:p></w:tc>
                  </w:tr></w:tbl></w:body>
                </w:document>
                """;
        var data = new ObjectMapper().readTree("""
                {"cambios":[{"zona":"Norte","descripcion":"Primera"},{"zona":"Sur","descripcion":"Segunda"}]}
                """);

        String adapted = documentXml(LegacyDocxTemplateAdapter.adapt(docx(document), data));

        assertTrue(adapted.contains("Norte"));
        assertTrue(adapted.contains("Primera"));
        assertTrue(adapted.contains("Sur"));
        assertTrue(adapted.contains("Segunda"));
        assertFalse(adapted.contains("jt:forEach"));
        assertFalse(adapted.contains("${cambio"));
    }

    @Test
    void preservesRunFormattingWhenTokensCrossRunsInComplexRows() throws Exception {
        String document = """
                <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                  <w:body><w:tbl><w:tr>
                    <w:tc><w:p>
                      <w:r><w:t>&lt;jt:forEach items=&quot;${ cambios }&quot; var=&quot;cambio&quot;&gt;</w:t></w:r>
                      <w:r><w:rPr><w:b/></w:rPr><w:t>${cambio.</w:t></w:r>
                      <w:r><w:rPr><w:b/></w:rPr><w:t>zona}</w:t></w:r>
                    </w:p></w:tc>
                    <w:tc><w:p>
                      <w:r><w:rPr><w:i/></w:rPr><w:t>${cambio.des</w:t></w:r>
                      <w:r><w:rPr><w:i/></w:rPr><w:t>cripcion}&lt;/jt:forEach&gt;</w:t></w:r>
                    </w:p></w:tc>
                  </w:tr></w:tbl></w:body>
                </w:document>
                """;
        var data = new ObjectMapper().readTree("""
                {"cambios":[{"zona":"Norte","descripcion":"Primera"},{"zona":"Sur","descripcion":"Segunda"}]}
                """);

        String adapted = documentXml(LegacyDocxTemplateAdapter.adapt(docx(document), data));

        assertTrue(adapted.contains("Norte") && adapted.contains("Sur"));
        assertTrue(adapted.contains("Primera") && adapted.contains("Segunda"));
        assertTrue(adapted.contains("<w:b") && adapted.contains("<w:i"));
        assertFalse(adapted.contains("jt:forEach"));
        assertFalse(adapted.contains("${cambio"));
    }

    private byte[] docx(String documentXml) throws Exception {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(output)) {
            zip.putNextEntry(new ZipEntry("word/document.xml"));
            zip.write(documentXml.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            return output.toByteArray();
        }
    }

    private String documentXml(byte[] content) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.getName().equals("word/document.xml")) return new String(zip.readAllBytes(), StandardCharsets.UTF_8);
            }
        }
        return "";
    }
}
