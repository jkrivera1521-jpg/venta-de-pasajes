package com.ventapasajes.report.api;

import com.ventapasajes.report.api.dto.GenerateReportRequest;
import com.ventapasajes.report.auth.RequestIdentity;
import com.ventapasajes.report.engine.GeneratedReport;
import com.ventapasajes.report.service.ReportGenerationService;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/reports")
@Tag(name = "reports")
public class ReportGenerationResource {
    @Inject ReportGenerationService generation;
    @Inject RequestIdentity identity;

    @POST
    @Path("/generate")
    @Produces({
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/pdf"})
    @Operation(summary = "Genera un documento desde una plantilla activa.")
    public Response generate(@Valid GenerateReportRequest request) {
        GeneratedReport result = generation.generate(request, identity.requireUser().actor());
        return Response.ok(result.content(), result.contentType())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + result.fileName() + "\"")
                .header(HttpHeaders.CONTENT_LENGTH, result.content().length)
                .build();
    }
}
