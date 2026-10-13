package com.ventapasajes.dispatch.api;

import java.net.URI;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.dispatch.api.dto.PageResponse;
import com.ventapasajes.dispatch.api.dto.RouteCreateRequest;
import com.ventapasajes.dispatch.api.dto.RouteResponse;
import com.ventapasajes.dispatch.api.dto.RouteUpdateRequest;
import com.ventapasajes.dispatch.service.AuditContext;
import com.ventapasajes.dispatch.service.TerminalRouteService;

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

@Path("/api/v1/dispatch/routes")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "routes")
public class RouteResource {

    @Inject
    TerminalRouteService terminalRouteService;

    @GET
    @Operation(summary = "List routes with search and filters.")
    @APIResponse(responseCode = "200", description = "Routes returned.")
    public PageResponse<RouteResponse> listRoutes(
            @QueryParam("page") @DefaultValue("1") int page,
            @QueryParam("page_size") @DefaultValue("25") int pageSize,
            @QueryParam("origin_terminal_id") UUID originTerminalId,
            @QueryParam("destination_terminal_id") UUID destinationTerminalId,
            @QueryParam("q") String q,
            @QueryParam("active") Boolean active) {
        return terminalRouteService.listRoutes(page, pageSize, originTerminalId, destinationTerminalId, q, active);
    }

    @POST
    @Operation(summary = "Create a route.")
    @APIResponse(responseCode = "201", description = "Route created.")
    @APIResponse(responseCode = "400", description = "Invalid route payload.")
    @APIResponse(responseCode = "404", description = "Terminal not found.")
    @APIResponse(responseCode = "409", description = "Route duplicate found.")
    public Response createRoute(
            RouteCreateRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        RouteResponse response = terminalRouteService.createRoute(request, auditContext(actorUserId, correlationId));
        return Response.created(URI.create("/api/v1/dispatch/routes/" + response.id()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/{routeId}")
    @Operation(summary = "Get a route.")
    @APIResponse(responseCode = "200", description = "Route returned.")
    @APIResponse(responseCode = "404", description = "Route not found.")
    public RouteResponse getRoute(
            @Parameter(required = true) @PathParam("routeId") UUID routeId) {
        return terminalRouteService.getRoute(routeId);
    }

    @PATCH
    @Path("/{routeId}")
    @Operation(summary = "Update a route.")
    @APIResponse(responseCode = "200", description = "Route updated.")
    @APIResponse(responseCode = "400", description = "Invalid route payload.")
    @APIResponse(responseCode = "404", description = "Route or terminal not found.")
    @APIResponse(responseCode = "409", description = "Route duplicate found.")
    public RouteResponse updateRoute(
            @Parameter(required = true) @PathParam("routeId") UUID routeId,
            RouteUpdateRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        return terminalRouteService.updateRoute(routeId, request, auditContext(actorUserId, correlationId));
    }

    @DELETE
    @Path("/{routeId}")
    @Operation(summary = "Deactivate a route.")
    @APIResponse(responseCode = "204", description = "Route deactivated.")
    @APIResponse(responseCode = "404", description = "Route not found.")
    public Response deactivateRoute(
            @Parameter(required = true) @PathParam("routeId") UUID routeId,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        terminalRouteService.deactivateRoute(routeId, auditContext(actorUserId, correlationId));
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
