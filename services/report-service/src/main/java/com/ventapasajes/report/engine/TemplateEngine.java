package com.ventapasajes.report.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.ventapasajes.report.domain.OutputFormat;
import com.ventapasajes.report.persistence.entity.ReportTemplateVersion;

public interface TemplateEngine {
    GeneratedReport generate(ReportTemplateVersion template, JsonNode parameters, OutputFormat format, String fileName);
}
