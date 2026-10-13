package com.ventapasajes.document.api.dto;

public record StoredDocument(
        String provider,
        String storageUri,
        String contentType,
        String fileName,
        String checksumSha256,
        long sizeBytes) {
}
