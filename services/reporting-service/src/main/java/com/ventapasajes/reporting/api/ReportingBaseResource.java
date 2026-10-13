package com.ventapasajes.reporting.api;

import java.util.List;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/v1/reporting")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "reporting")
public class ReportingBaseResource {

    @ConfigProperty(name = "quarkus.application.name")
    String serviceName;

    @GET
    @Operation(summary = "Return reporting service overview.")
    @APIResponse(responseCode = "200", description = "Overview returned.")
    public ReportingOverview overview() {
        return new ReportingOverview(
                serviceName,
                "0.1.0",
                "reporting_db",
                "read-model",
                List.of("TicketSold", "TicketCancelled"));
    }

    @GET
    @Path("/resources")
    @Operation(summary = "Return implemented reporting resources.")
    @APIResponse(responseCode = "200", description = "Resources returned.")
    public List<String> resources() {
        return List.of(
                "events/ticket-sold",
                "events/ticket-cancelled",
                "reports/sales",
                "reports/passengers",
                "reports/sales/by-user",
                "reports/sales/by-bus");
    }

    public record ReportingOverview(
            String service,
            String version,
            String database,
            String model,
            List<String> consumedEvents) {
    }
}
