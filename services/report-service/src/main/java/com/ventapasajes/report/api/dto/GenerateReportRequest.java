package com.ventapasajes.report.api.dto;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record GenerateReportRequest(
        @NotBlank @JsonProperty("templateCode") String templateCode,
        @JsonProperty("templateVersion") Integer templateVersion,
        @NotNull @JsonProperty("outputFormat") String outputFormat,
        @NotNull @JsonProperty("data") @JsonAlias("parameters") Map<String, Object> parameters,
        @JsonProperty("fileName") String fileName) {
}
