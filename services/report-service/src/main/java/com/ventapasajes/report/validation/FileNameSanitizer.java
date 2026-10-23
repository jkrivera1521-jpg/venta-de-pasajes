package com.ventapasajes.report.validation;

import java.text.Normalizer;
import java.util.Locale;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class FileNameSanitizer {
    public String sanitize(String value, String fallback, String extension) {
        String source = value == null ? fallback : value;
        String normalized = Normalizer.normalize(source, Normalizer.Form.NFKC)
                .replace('\\', '_').replace('/', '_').replaceAll("[^a-zA-Z0-9._ -]", "_")
                .replaceAll("\\s+", " ").trim();
        if (normalized.isBlank() || ".".equals(normalized) || "..".equals(normalized)) normalized = fallback;
        int dot = normalized.lastIndexOf('.');
        if (dot > 0) normalized = normalized.substring(0, dot);
        normalized = normalized.replaceAll("[. ]+$", "");
        normalized = normalized.replaceFirst("^[._]+", "");
        if (normalized.isBlank()) normalized = fallback;
        String ext = extension.toLowerCase(Locale.ROOT);
        return normalized.substring(0, Math.min(normalized.length(), 150)) + "." + ext;
    }

    public String zipEntry(String value, int index, String extension) {
        return sanitize(value, "documento-" + (index + 1), extension);
    }
}
