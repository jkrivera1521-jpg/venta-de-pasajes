package com.ventapasajes.report.api.dto;

import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public record TemplateVersionResponse(
        String code,
        int version,
        String name,
        String description,
        @JsonProperty("documentType") String documentType,
        @JsonProperty("fileName") String fileName,
        @JsonProperty("contentType") String contentType,
        @JsonProperty("fileSize") long fileSize,
        @JsonProperty("checksumSha256") String checksumSha256,
        String status,
        @JsonProperty("createdBy") String createdBy,
        @JsonProperty("createdAt") Instant createdAt,
        @JsonProperty("activatedAt") Instant activatedAt,
        List<TemplateParameterResponse> parameters) {
}
