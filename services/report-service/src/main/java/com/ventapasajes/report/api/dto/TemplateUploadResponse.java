package com.ventapasajes.report.api.dto;

import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;

public record TemplateUploadResponse(
        @JsonProperty("templateId") UUID templateId,
        String code,
        int version,
        @JsonProperty("documentType") String documentType,
        String status,
        @JsonProperty("checksumSha256") String checksumSha256,
        List<TemplateParameterResponse> parameters,
        TemplateInspectionResponse inspection) {
}
