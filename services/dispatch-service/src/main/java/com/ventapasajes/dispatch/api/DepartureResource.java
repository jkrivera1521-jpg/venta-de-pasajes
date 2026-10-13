package com.ventapasajes.dispatch.api;

import java.net.URI;
import java.time.LocalDate;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.dispatch.api.dto.DepartureCancelRequest;
import com.ventapasajes.dispatch.api.dto.DepartureCreateRequest;
import com.ventapasajes.dispatch.api.dto.DepartureResponse;
import com.ventapasajes.dispatch.api.dto.DepartureUpdateRequest;
import com.ventapasajes.dispatch.api.dto.PageResponse;
import com.ventapasajes.dispatch.domain.DepartureStatus;
import com.ventapasajes.dispatch.service.AuditContext;
import com.ventapasajes.dispatch.service.DepartureScheduleService;

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

@Path("/api/v1/dispatch/departures")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "departures")
public class DepartureResource {

    @Inject
    DepartureScheduleService departureScheduleService;

    @GET
    @Operation(summary = "List scheduled departures with filters.")
    @APIResponse(responseCode = "200", description = "Departures returned.")
    public PageResponse<DepartureResponse> listDepartures(
            @QueryParam("page") @DefaultValue("1") int page,
            @QueryParam("page_size") @DefaultValue("25") int pageSize,
            @QueryParam("date_from") LocalDate dateFrom,
            @QueryParam("date_to") LocalDate dateTo,
            @QueryParam("route_id") UUID routeId,
            @QueryParam("bus_id") UUID busId,
            @QueryParam("status") DepartureStatus status) {
        return departureScheduleService.listDepartures(page, pageSize, dateFrom, dateTo, routeId, busId, status);
    }

    @POST
    @Operation(summary = "Create a scheduled departure.")
    @APIResponse(responseCode = "201", description = "Departure scheduled.")
    @APIResponse(responseCode = "400", description = "Invalid departure payload.")
    @APIResponse(responseCode = "404", description = "Bus or route not found.")
    @APIResponse(responseCode = "409", description = "Bus schedule conflict.")
    public Response createDeparture(
            DepartureCreateRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        DepartureResponse response = departureScheduleService.createDeparture(request, auditContext(actorUserId, correlationId));
        return Response.created(URI.create("/api/v1/dispatch/departures/" + response.id()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/{departureId}")
    @Operation(summary = "Get a departure.")
    @APIResponse(responseCode = "200", description = "Departure returned.")
    @APIResponse(responseCode = "404", description = "Departure not found.")
    public DepartureResponse getDeparture(
            @Parameter(required = true) @PathParam("departureId") UUID departureId) {
        return departureScheduleService.getDeparture(departureId);
    }

    @PATCH
    @Path("/{departureId}")
    @Operation(summary = "Update a scheduled departure.")
    @APIResponse(responseCode = "200", description = "Departure updated.")
    @APIResponse(responseCode = "400", description = "Invalid departure payload.")
    @APIResponse(responseCode = "404", description = "Departure, bus or route not found.")
    @APIResponse(responseCode = "409", description = "Departure cannot be updated or bus schedule conflict.")
    public DepartureResponse updateDeparture(
            @Parameter(required = true) @PathParam("departureId") UUID departureId,
            DepartureUpdateRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        return departureScheduleService.updateDeparture(departureId, request, auditContext(actorUserId, correlationId));
    }

    @DELETE
    @Path("/{departureId}")
    @Operation(summary = "Cancel a departure.")
    @APIResponse(responseCode = "204", description = "Departure cancelled.")
    @APIResponse(responseCode = "404", description = "Departure not found.")
    public Response cancelDeparture(
            @Parameter(required = true) @PathParam("departureId") UUID departureId,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        departureScheduleService.cancelDeparture(departureId, null, auditContext(actorUserId, correlationId));
        return Response.noContent().build();
    }

    @POST
    @Path("/{departureId}/cancel")
    @Operation(summary = "Cancel a departure with a reason.")
    @APIResponse(responseCode = "200", description = "Departure cancelled.")
    @APIResponse(responseCode = "404", description = "Departure not found.")
    public DepartureResponse cancelDepartureWithReason(
            @Parameter(required = true) @PathParam("departureId") UUID departureId,
            DepartureCancelRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        return departureScheduleService.cancelDeparture(departureId, request, auditContext(actorUserId, correlationId));
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
