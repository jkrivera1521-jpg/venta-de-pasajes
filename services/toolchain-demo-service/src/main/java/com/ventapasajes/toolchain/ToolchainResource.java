package com.ventapasajes.toolchain;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/v1/toolchain")
@Produces(MediaType.APPLICATION_JSON)
public class ToolchainResource {

    @GET
    @Path("/health")
    public ToolchainStatus health() {
        return new ToolchainStatus("ok", "toolchain-demo-service", "quarkus");
    }

    public record ToolchainStatus(String status, String service, String runtime) {
    }
}
