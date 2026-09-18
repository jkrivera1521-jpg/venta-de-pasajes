package com.ventapasajes.dispatch.api;

import java.net.URI;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.dispatch.api.dto.PageResponse;
import com.ventapasajes.dispatch.api.dto.SeatLayoutCreateRequest;
import com.ventapasajes.dispatch.api.dto.SeatLayoutResponse;
import com.ventapasajes.dispatch.api.dto.SeatLayoutUpdateRequest;
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

@Path("/api/v1/dispatch/seat-layouts")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "seat-layouts")
public class SeatLayoutResource {

    @Inject
    BusFleetService busFleetService;

    @GET
    @Operation(summary = "List seat layouts with search and filters.")
    @APIResponse(responseCode = "200", description = "Seat layouts returned.")
    public PageResponse<SeatLayoutResponse> listSeatLayouts(
            @QueryParam("page") @DefaultValue("1") int page,
            @QueryParam("page_size") @DefaultValue("25") int pageSize,
            @QueryParam("q") String q,
            @QueryParam("active") Boolean active) {
        return busFleetService.listSeatLayouts(page, pageSize, q, active);
    }

    @POST
    @Operation(summary = "Create a seat layout.")
    @APIResponse(responseCode = "201", description = "Seat layout created.")
    @APIResponse(responseCode = "400", description = "Invalid seat layout payload.")
    @APIResponse(responseCode = "409", description = "Seat layout duplicate found.")
    public Response createSeatLayout(
            SeatLayoutCreateRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        SeatLayoutResponse response = busFleetService.createSeatLayout(request, auditContext(actorUserId, correlationId));
        return Response.created(URI.create("/api/v1/dispatch/seat-layouts/" + response.id()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/{seatLayoutId}")
    @Operation(summary = "Get a seat layout.")
    @APIResponse(responseCode = "200", description = "Seat layout returned.")
    @APIResponse(responseCode = "404", description = "Seat layout not found.")
    public SeatLayoutResponse getSeatLayout(
            @Parameter(required = true) @PathParam("seatLayoutId") UUID seatLayoutId) {
        return busFleetService.getSeatLayout(seatLayoutId);
    }

    @PATCH
    @Path("/{seatLayoutId}")
    @Operation(summary = "Update a seat layout.")
    @APIResponse(responseCode = "200", description = "Seat layout updated.")
    @APIResponse(responseCode = "400", description = "Invalid seat layout payload.")
    @APIResponse(responseCode = "404", description = "Seat layout not found.")
    @APIResponse(responseCode = "409", description = "Seat layout duplicate found or in use.")
    public SeatLayoutResponse updateSeatLayout(
            @Parameter(required = true) @PathParam("seatLayoutId") UUID seatLayoutId,
            SeatLayoutUpdateRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        return busFleetService.updateSeatLayout(seatLayoutId, request, auditContext(actorUserId, correlationId));
    }

    @DELETE
    @Path("/{seatLayoutId}")
    @Operation(summary = "Deactivate a seat layout.")
    @APIResponse(responseCode = "204", description = "Seat layout deactivated.")
    @APIResponse(responseCode = "404", description = "Seat layout not found.")
    @APIResponse(responseCode = "409", description = "Seat layout is in use.")
    public Response deactivateSeatLayout(
            @Parameter(required = true) @PathParam("seatLayoutId") UUID seatLayoutId,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        busFleetService.deactivateSeatLayout(seatLayoutId, auditContext(actorUserId, correlationId));
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
