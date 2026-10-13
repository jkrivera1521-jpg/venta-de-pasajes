package com.ventapasajes.document.api.dto;

public record DownloadPayload(
        byte[] content,
        String contentType,
        String fileName) {
}
