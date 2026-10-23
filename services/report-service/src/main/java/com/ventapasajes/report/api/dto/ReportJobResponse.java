package com.ventapasajes.report.api.dto;

import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ReportJobResponse(
        UUID id,
        @JsonProperty("templateCode") String templateCode,
        @JsonProperty("templateVersion") Integer templateVersion,
        @JsonProperty("outputFormat") String outputFormat,
        String status,
        @JsonProperty("totalItems") int totalItems,
        @JsonProperty("processedItems") int processedItems,
        @JsonProperty("successfulItems") int successfulItems,
        @JsonProperty("failedItems") int failedItems,
        @JsonProperty("zipFileName") String zipFileName,
        @JsonProperty("downloadUrl") String downloadUrl,
        @JsonProperty("errorMessage") String error,
        @JsonProperty("createdAt") Instant createdAt,
        @JsonProperty("completedAt") Instant completedAt,
        @JsonProperty("expiresAt") Instant expiresAt) {
}
