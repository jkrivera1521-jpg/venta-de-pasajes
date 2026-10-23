package com.ventapasajes.report.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record TemplateParameterResponse(
        String name,
        String path,
        @JsonProperty("dataType") String dataType,
        boolean required,
        boolean repeated,
        boolean collection,
        Object defaultValue,
        String description,
        String source) {
}
