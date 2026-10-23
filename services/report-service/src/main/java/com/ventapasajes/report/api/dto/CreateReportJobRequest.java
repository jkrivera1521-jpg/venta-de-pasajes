package com.ventapasajes.report.api.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record CreateReportJobRequest(
        @NotBlank @JsonProperty("templateCode") String templateCode,
        @JsonProperty("templateVersion") Integer templateVersion,
        @NotNull @JsonProperty("outputFormat") String outputFormat,
        @NotEmpty List<@Valid BatchDocumentRequest> documents,
        @JsonProperty("zipFileName") String zipFileName) {
}
