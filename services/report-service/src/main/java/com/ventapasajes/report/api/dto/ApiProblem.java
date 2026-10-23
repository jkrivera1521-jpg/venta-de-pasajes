package com.ventapasajes.report.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiProblem(
        String type,
        String title,
        int status,
        String code,
        String detail,
        String traceId) {
}
