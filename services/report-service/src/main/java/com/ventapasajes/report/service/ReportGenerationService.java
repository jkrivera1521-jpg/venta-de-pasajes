package com.ventapasajes.report.service;

import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.report.api.ReportServiceException;
import com.ventapasajes.report.api.dto.GenerateReportRequest;
import com.ventapasajes.report.domain.DocumentType;
import com.ventapasajes.report.domain.OutputFormat;
import com.ventapasajes.report.engine.DocxTemplateEngine;
import com.ventapasajes.report.engine.GeneratedReport;
import com.ventapasajes.report.engine.JxlsExcelTemplateEngine;
import com.ventapasajes.report.persistence.entity.ReportTemplateParameter;
import com.ventapasajes.report.persistence.entity.ReportTemplateVersion;
import com.ventapasajes.report.validation.FileNameSanitizer;
import com.ventapasajes.report.validation.ReportParameterValidator;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response;

@ApplicationScoped
public class ReportGenerationService {
    @Inject TemplateCatalogService catalog;
    @Inject ReportParameterValidator parameterValidator;
    @Inject ObjectMapper objectMapper;
    @Inject FileNameSanitizer fileNames;
    @Inject JxlsExcelTemplateEngine excel;
    @Inject DocxTemplateEngine docx;
    @Inject ReportAuditService audit;
    @ConfigProperty(name = "app.report.pdf.enabled") boolean pdfEnabled;
    @ConfigProperty(name = "app.report.pdf.max-bytes") long pdfMaxBytes;

    public GeneratedReport generate(GenerateReportRequest request) {
        return generate(request, "desconocido");
    }

    public GeneratedReport generate(GenerateReportRequest request, String actor) {
        ReportTemplateVersion template = catalog.requireGenerationVersion(request.templateCode(), request.templateVersion());
        OutputFormat format = parseFormat(request.outputFormat());
        if (format == OutputFormat.PDF && !pdfEnabled) throw new ReportServiceException(Response.Status.NOT_IMPLEMENTED, "PDF_DISABLED", "La generacion PDF esta deshabilitada.");
        if (template.template.documentType == DocumentType.XLSX && format != OutputFormat.XLSX) throw new ReportServiceException(422, "UNSUPPORTED_OUTPUT_FORMAT", "Una plantilla XLSX solo genera XLSX.");
        if (template.template.documentType == DocumentType.DOCX && format == OutputFormat.XLSX) throw new ReportServiceException(422, "UNSUPPORTED_OUTPUT_FORMAT", "Una plantilla DOCX no genera XLSX.");
        JsonNode parameters = parameterValidator.validate(request.parameters(), catalog.parametersFor(template));
        String extension = format.name().toLowerCase();
        String name = fileNames.sanitize(request.fileName(), template.template.code.toLowerCase() + "-v" + template.version, extension);
        GeneratedReport result = template.template.documentType == DocumentType.XLSX
                ? excel.generate(template, parameters, format, name)
                : docx.generate(template, parameters, format, name);
        if (format == OutputFormat.PDF && result.content().length > pdfMaxBytes) {
            throw new ReportServiceException(413, "PDF_TOO_LARGE", "El PDF generado supera el limite configurado.");
        }
        audit.record("REPORT_GENERATED", "REPORT_TEMPLATE_VERSION", template.id.toString(), actor,
                Map.of("templateCode", template.template.code, "version", template.version, "outputFormat", format.name()));
        return result;
    }

    private OutputFormat parseFormat(String value) {
        try { return OutputFormat.valueOf(value.toUpperCase()); }
        catch (Exception error) { throw new ReportServiceException(Response.Status.BAD_REQUEST, "INVALID_OUTPUT_FORMAT", "El formato de salida no es valido."); }
    }
}
