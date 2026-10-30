package com.ventapasajes.report.api.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.ventapasajes.report.validation.TemplateInspection;

public record TemplateInspectionResponse(
        String engine,
        List<String> features,
        @JsonProperty("xmlRoot") String xmlRoot,
        List<String> warnings) {

    public static TemplateInspectionResponse from(TemplateInspection inspection) {
        return new TemplateInspectionResponse(
                inspection.engine().name(),
                inspection.features().stream().map(Enum::name).toList(),
                inspection.xmlRoot(),
                inspection.warnings());
    }
}
