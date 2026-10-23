package com.ventapasajes.report.api;

import java.util.UUID;

import com.ventapasajes.report.api.dto.CreateReportJobRequest;
import com.ventapasajes.report.api.dto.ReportJobResponse;
import com.ventapasajes.report.auth.RequestIdentity;
import com.ventapasajes.report.service.ReportJobService;
import com.ventapasajes.report.service.ReportJobWorker;

import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/report-jobs")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "report-jobs")
public class ReportJobResource {
    @Inject ReportJobService jobs;
    @Inject ReportJobWorker worker;
    @Inject RequestIdentity identity;

    @POST
    public Response create(@Valid CreateReportJobRequest request) {
        ReportJobResponse result = jobs.create(request, identity.requireUser());
        worker.submit(result.id());
        return Response.status(Response.Status.ACCEPTED).entity(result).build();
    }

    @GET
    @Path("/{id}")
    public ReportJobResponse get(@PathParam("id") UUID id) { return jobs.get(id); }

    @GET
    @Path("/{id}/download")
    @Produces("application/zip")
    public Response download(@PathParam("id") UUID id) { return Response.ok(jobs.download(id), "application/zip").header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"reportes.zip\"").build(); }

    @POST
    @Path("/{id}/cancel")
    public Response cancel(@PathParam("id") UUID id) { jobs.cancel(id); return Response.noContent().build(); }
}
