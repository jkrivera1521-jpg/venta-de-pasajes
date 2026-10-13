package com.ventapasajes.document.api;

import java.time.Instant;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

@Schema(name = "ServiceStatus", description = "Basic service status response.")
public record ServiceStatus(
        @Schema(description = "Status value.") String status,
        @Schema(description = "Service name.") String service,
        @Schema(description = "Runtime name.") String runtime,
        Instant checkedAt) {

    public static ServiceStatus ok(String service) {
        return new ServiceStatus("ok", service, "quarkus", Instant.now());
    }
}
