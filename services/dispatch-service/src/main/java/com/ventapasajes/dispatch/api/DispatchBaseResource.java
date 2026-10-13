package com.ventapasajes.dispatch.api;

import java.util.List;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.dispatch.api.dto.DispatchOverviewResponse;
import com.ventapasajes.dispatch.api.dto.DispatchResourceResponse;
import com.ventapasajes.dispatch.service.DispatchCatalogService;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/v1/dispatch")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "dispatch")
public class DispatchBaseResource {

    @Inject
    DispatchCatalogService catalogService;

    @GET
    @Operation(summary = "Return dispatch service overview.")
    @APIResponse(responseCode = "200", description = "Dispatch service overview returned.")
    public DispatchOverviewResponse overview() {
        return catalogService.overview();
    }

    @GET
    @Path("/resources")
    @Operation(summary = "Return dispatch resources planned for this domain.")
    @APIResponse(responseCode = "200", description = "Dispatch resources returned.")
    public List<DispatchResourceResponse> resources() {
        return catalogService.resources();
    }

    @GET
    @Path("/departure-statuses")
    @Operation(summary = "Return supported departure statuses.")
    @APIResponse(responseCode = "200", description = "Departure statuses returned.")
    public List<String> departureStatuses() {
        return catalogService.departureStatuses();
    }

    @GET
    @Path("/seat-positions")
    @Operation(summary = "Return supported seat positions.")
    @APIResponse(responseCode = "200", description = "Seat positions returned.")
    public List<String> seatPositions() {
        return catalogService.seatPositions();
    }
}
