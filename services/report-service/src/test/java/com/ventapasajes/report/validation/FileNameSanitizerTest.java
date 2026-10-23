package com.ventapasajes.report.validation;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class FileNameSanitizerTest {
    private final FileNameSanitizer sanitizer = new FileNameSanitizer();

    @Test
    void removesTraversalAndControlsExtension() {
        assertEquals("reporte_2026.xlsx", sanitizer.sanitize("../reporte_2026.exe", "fallback", "xlsx"));
    }

    @Test
    void providesStableFallback() {
        assertEquals("fallback.pdf", sanitizer.sanitize("../", "fallback", "pdf"));
    }
}
