package com.ventapasajes.report.validation;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RichTextSanitizerTest {
    @Test
    void acceptsTheDocumentedSubset() {
        String result = new RichTextSanitizer().sanitize("<p><strong>Importante</strong> <em>hoy</em><br/><u>Detalle</u></p><ul><li>Uno</li></ul>");

        assertTrue(result.contains("<strong>Importante</strong>"));
        assertTrue(result.contains("<br>"));
        assertTrue(result.contains("<li>Uno</li>"));
    }

    @Test
    void rejectsActiveContentAndUnsafeLinks() {
        RichTextSanitizer sanitizer = new RichTextSanitizer();

        assertThrows(IllegalArgumentException.class, () -> sanitizer.sanitize("<script>alert(1)</script>"));
        assertThrows(IllegalArgumentException.class, () -> sanitizer.sanitize("<p onclick=alert(1)>texto</p>"));
        assertThrows(IllegalArgumentException.class, () -> sanitizer.sanitize("<a href=\"javascript:alert(1)\">enlace</a>"));
    }
}
