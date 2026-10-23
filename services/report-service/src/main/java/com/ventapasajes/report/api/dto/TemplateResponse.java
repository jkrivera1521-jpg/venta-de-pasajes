package com.ventapasajes.report.api.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonProperty;

public record TemplateResponse(
        String code,
        String name,
        String description,
        @JsonProperty("documentType") String documentType,
        String status,
        @JsonProperty("activeVersion") Integer activeVersion,
        @JsonProperty("createdBy") String createdBy,
        @JsonProperty("createdAt") Instant createdAt,
        @JsonProperty("updatedAt") Instant updatedAt) {
}
