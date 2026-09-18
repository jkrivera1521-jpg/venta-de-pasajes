package com.ventapasajes.dispatch.api;

import java.net.URI;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.dispatch.api.dto.BusCreateRequest;
import com.ventapasajes.dispatch.api.dto.BusResponse;
import com.ventapasajes.dispatch.api.dto.BusUpdateRequest;
import com.ventapasajes.dispatch.api.dto.PageResponse;
import com.ventapasajes.dispatch.service.AuditContext;
import com.ventapasajes.dispatch.service.BusFleetService;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/dispatch/buses")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "buses")
public class BusResource {

    @Inject
    BusFleetService busFleetService;

    @GET
    @Operation(summary = "List buses with search and filters.")
    @APIResponse(responseCode = "200", description = "Buses returned.")
    public PageResponse<BusResponse> listBuses(
            @QueryParam("page") @DefaultValue("1") int page,
            @QueryParam("page_size") @DefaultValue("25") int pageSize,
            @QueryParam("q") String q,
            @QueryParam("terminal_id") UUID terminalId,
            @QueryParam("bus_type_id") UUID busTypeId,
            @QueryParam("seat_layout_id") UUID seatLayoutId,
            @QueryParam("active") Boolean active) {
        return busFleetService.listBuses(page, pageSize, q, terminalId, busTypeId, seatLayoutId, active);
    }

    @POST
    @Operation(summary = "Create a bus.")
    @APIResponse(responseCode = "201", description = "Bus created.")
    @APIResponse(responseCode = "400", description = "Invalid bus payload.")
    @APIResponse(responseCode = "404", description = "Related resource not found.")
    @APIResponse(responseCode = "409", description = "Bus duplicate found.")
    public Response createBus(
            BusCreateRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        BusResponse response = busFleetService.createBus(request, auditContext(actorUserId, correlationId));
        return Response.created(URI.create("/api/v1/dispatch/buses/" + response.id()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/{busId}")
    @Operation(summary = "Get a bus.")
    @APIResponse(responseCode = "200", description = "Bus returned.")
    @APIResponse(responseCode = "404", description = "Bus not found.")
    public BusResponse getBus(
            @Parameter(required = true) @PathParam("busId") UUID busId) {
        return busFleetService.getBus(busId);
    }

    @PATCH
    @Path("/{busId}")
    @Operation(summary = "Update a bus.")
    @APIResponse(responseCode = "200", description = "Bus updated.")
    @APIResponse(responseCode = "400", description = "Invalid bus payload.")
    @APIResponse(responseCode = "404", description = "Bus or related resource not found.")
    @APIResponse(responseCode = "409", description = "Bus duplicate found.")
    public BusResponse updateBus(
            @Parameter(required = true) @PathParam("busId") UUID busId,
            BusUpdateRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        return busFleetService.updateBus(busId, request, auditContext(actorUserId, correlationId));
    }

    @DELETE
    @Path("/{busId}")
    @Operation(summary = "Deactivate a bus.")
    @APIResponse(responseCode = "204", description = "Bus deactivated.")
    @APIResponse(responseCode = "404", description = "Bus not found.")
    @APIResponse(responseCode = "409", description = "Bus has scheduled departures.")
    public Response deactivateBus(
            @Parameter(required = true) @PathParam("busId") UUID busId,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        busFleetService.deactivateBus(busId, auditContext(actorUserId, correlationId));
        return Response.noContent().build();
    }

    private AuditContext auditContext(String actorUserId, String correlationId) {
        return new AuditContext(optionalUuid(actorUserId, "X-Actor-User-Id"), optionalUuid(correlationId, "X-Correlation-Id"));
    }

    private UUID optionalUuid(String value, String headerName) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException exception) {
            throw ApiException.validation("INVALID_HEADER", "Header must be a valid UUID: " + headerName + ".");
        }
    }
}
