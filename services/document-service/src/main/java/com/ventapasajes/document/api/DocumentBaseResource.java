package com.ventapasajes.document.api;

import java.util.List;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.document.api.dto.DocumentOverviewResponse;
import com.ventapasajes.document.api.dto.DocumentResourceResponse;
import com.ventapasajes.document.service.DocumentCatalogService;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/v1/document")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "documents")
public class DocumentBaseResource {

    @Inject
    DocumentCatalogService catalogService;

    @GET
    @Operation(summary = "Return document domain overview.")
    @APIResponse(responseCode = "200", description = "Document overview returned.")
    public DocumentOverviewResponse overview() {
        return catalogService.overview();
    }

    @GET
    @Path("/resources")
    @Operation(summary = "Return managed document resources.")
    @APIResponse(responseCode = "200", description = "Managed resources returned.")
    public List<DocumentResourceResponse> resources() {
        return catalogService.resources();
    }
}
