package com.ventapasajes.report.api.dto;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotNull;

public record BatchDocumentRequest(
        @NotNull @JsonProperty("data") @JsonAlias("parameters") Map<String, Object> parameters,
        @JsonProperty("fileName") String fileName) {
}
