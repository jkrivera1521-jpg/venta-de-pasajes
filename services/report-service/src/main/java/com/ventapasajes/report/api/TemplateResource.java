package com.ventapasajes.report.api;

import java.io.IOException;
import java.nio.file.Files;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.report.api.dto.TemplateParameterResponse;
import com.ventapasajes.report.api.dto.TemplateResponse;
import com.ventapasajes.report.api.dto.TemplateUploadResponse;
import com.ventapasajes.report.api.dto.TemplateVersionResponse;
import com.ventapasajes.report.auth.AuthenticatedUser;
import com.ventapasajes.report.auth.RequestIdentity;
import com.ventapasajes.report.service.TemplateCatalogService;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/templates")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "templates")
public class TemplateResource {
    @Inject TemplateCatalogService catalog;
    @Inject RequestIdentity identity;
    @Inject ObjectMapper objectMapper;

    @POST
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Operation(summary = "Crea una plantilla o una nueva version.")
    public Response upload(@RestForm("file") FileUpload file,
            @RestForm("code") String code,
            @RestForm("name") String name,
            @RestForm("description") String description,
            @RestForm("version") Integer version,
            @RestForm("activate") @DefaultValue("false") boolean activate,
            @RestForm("parameterSchema") String parameterSchema) throws IOException {
        if (file == null) throw new ReportServiceException(Response.Status.BAD_REQUEST, "FILE_REQUIRED", "El archivo de plantilla es obligatorio.");
        JsonNode schema = null;
        if (parameterSchema != null && !parameterSchema.isBlank()) {
            try { schema = objectMapper.readTree(parameterSchema); }
            catch (Exception error) { throw new ReportServiceException(Response.Status.BAD_REQUEST, "INVALID_PARAMETER_SCHEMA", "parameterSchema debe ser JSON valido."); }
        }
        AuthenticatedUser user = identity.requireUser();
        TemplateUploadResponse result = catalog.upload(code, name, description, version, activate, file.fileName(), file.contentType(), Files.readAllBytes(file.uploadedFile()), schema, user.actor());
        return Response.status(Response.Status.CREATED).entity(result).build();
    }

    @GET
    @Operation(summary = "Lista plantillas visibles.")
    public List<TemplateResponse> list(@QueryParam("code") String code,
            @QueryParam("documentType") String documentType,
            @QueryParam("status") String status,
            @QueryParam("version") Integer version) { return catalog.list(code, documentType, status, version); }

    @GET
    @Path("/{code}")
    public TemplateVersionResponse get(@PathParam("code") String code, @QueryParam("version") Integer version) { return catalog.get(code, version); }

    @DELETE
    @Path("/{code}")
    public Response delete(@PathParam("code") String code) {
        catalog.delete(code, identity.requireUser().actor());
        return Response.noContent().build();
    }

    @GET
    @Path("/{code}/versions")
    public List<TemplateVersionResponse> versions(@PathParam("code") String code) { return catalog.listVersions(code); }

    @GET
    @Path("/{code}/versions/{version}")
    public TemplateVersionResponse version(@PathParam("code") String code, @PathParam("version") int version) { return catalog.get(code, version); }

    @GET
    @Path("/{code}/parameters")
    public List<TemplateParameterResponse> activeParameters(@PathParam("code") String code) { return catalog.listActiveParameters(code); }

    @GET
    @Path("/{code}/versions/{version}/parameters")
    public List<TemplateParameterResponse> parameters(@PathParam("code") String code, @PathParam("version") int version) { return catalog.listParameters(code, version); }

    @GET
    @Path("/{code}/versions/{version}/download")
    @Produces(MediaType.APPLICATION_OCTET_STREAM)
    @Operation(summary = "Descarga el archivo original de una version.")
    public Response download(@PathParam("code") String code, @PathParam("version") int version) {
        TemplateCatalogService.TemplateDownload result = catalog.download(code, version);
        return Response.ok(result.content(), result.contentType())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeFileName(result.fileName()) + "\"")
                .header(HttpHeaders.CONTENT_LENGTH, result.content().length)
                .build();
    }

    @POST
    @Path("/{code}/versions/{version}/activate")
    public Response activate(@PathParam("code") String code, @PathParam("version") int version) {
        catalog.activate(code, version, identity.requireUser().actor());
        return Response.noContent().build();
    }

    private String safeFileName(String value) {
        if (value == null || value.isBlank()) return "plantilla-original";
        return value.replace("\\", "_").replace("/", "_").replace("\"", "_").replace("\r", "_").replace("\n", "_");
    }
}
