package com.ventapasajes.template.api;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/v1/template")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "health")
public class TemplateHealthResource {

    @ConfigProperty(name = "quarkus.application.name")
    String serviceName;

    @GET
    @Path("/health")
    @Operation(summary = "Return service status.")
    @APIResponse(responseCode = "200", description = "Service status returned.")
    public ServiceStatus health() {
        return ServiceStatus.ok(serviceName);
    }
}
