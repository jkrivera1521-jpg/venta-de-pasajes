package com.ventapasajes.audit.api;

import java.util.List;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/v1/audit")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "audit")
public class AuditBaseResource {

    @ConfigProperty(name = "quarkus.application.name")
    String serviceName;

    @GET
    @Operation(summary = "Return audit service overview.")
    @APIResponse(responseCode = "200", description = "Overview returned.")
    public AuditOverview overview() {
        return new AuditOverview(
                serviceName,
                "0.1.0",
                "audit_db",
                "append-only",
                List.of("audit-events", "processed-events", "outbox-events"));
    }

    @GET
    @Path("/resources")
    @Operation(summary = "Return implemented audit resources.")
    @APIResponse(responseCode = "200", description = "Resources returned.")
    public List<String> resources() {
        return List.of(
                "audit-events",
                "audit-events/{eventId}",
                "health");
    }

    public record AuditOverview(
            String service,
            String version,
            String database,
            String model,
            List<String> resources) {
    }
}
