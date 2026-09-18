package com.ventapasajes.dispatch.api;

import java.net.URI;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.dispatch.api.dto.BusTypeCreateRequest;
import com.ventapasajes.dispatch.api.dto.BusTypeResponse;
import com.ventapasajes.dispatch.api.dto.BusTypeUpdateRequest;
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

@Path("/api/v1/dispatch/bus-types")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "bus-types")
public class BusTypeResource {

    @Inject
    BusFleetService busFleetService;

    @GET
    @Operation(summary = "List bus types with search and filters.")
    @APIResponse(responseCode = "200", description = "Bus types returned.")
    public PageResponse<BusTypeResponse> listBusTypes(
            @QueryParam("page") @DefaultValue("1") int page,
            @QueryParam("page_size") @DefaultValue("25") int pageSize,
            @QueryParam("q") String q,
            @QueryParam("active") Boolean active) {
        return busFleetService.listBusTypes(page, pageSize, q, active);
    }

    @POST
    @Operation(summary = "Create a bus type.")
    @APIResponse(responseCode = "201", description = "Bus type created.")
    @APIResponse(responseCode = "400", description = "Invalid bus type payload.")
    @APIResponse(responseCode = "409", description = "Bus type duplicate found.")
    public Response createBusType(
            BusTypeCreateRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        BusTypeResponse response = busFleetService.createBusType(request, auditContext(actorUserId, correlationId));
        return Response.created(URI.create("/api/v1/dispatch/bus-types/" + response.id()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/{busTypeId}")
    @Operation(summary = "Get a bus type.")
    @APIResponse(responseCode = "200", description = "Bus type returned.")
    @APIResponse(responseCode = "404", description = "Bus type not found.")
    public BusTypeResponse getBusType(
            @Parameter(required = true) @PathParam("busTypeId") UUID busTypeId) {
        return busFleetService.getBusType(busTypeId);
    }

    @PATCH
    @Path("/{busTypeId}")
    @Operation(summary = "Update a bus type.")
    @APIResponse(responseCode = "200", description = "Bus type updated.")
    @APIResponse(responseCode = "400", description = "Invalid bus type payload.")
    @APIResponse(responseCode = "404", description = "Bus type not found.")
    @APIResponse(responseCode = "409", description = "Bus type duplicate found.")
    public BusTypeResponse updateBusType(
            @Parameter(required = true) @PathParam("busTypeId") UUID busTypeId,
            BusTypeUpdateRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        return busFleetService.updateBusType(busTypeId, request, auditContext(actorUserId, correlationId));
    }

    @DELETE
    @Path("/{busTypeId}")
    @Operation(summary = "Deactivate a bus type.")
    @APIResponse(responseCode = "204", description = "Bus type deactivated.")
    @APIResponse(responseCode = "404", description = "Bus type not found.")
    @APIResponse(responseCode = "409", description = "Bus type is in use.")
    public Response deactivateBusType(
            @Parameter(required = true) @PathParam("busTypeId") UUID busTypeId,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        busFleetService.deactivateBusType(busTypeId, auditContext(actorUserId, correlationId));
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
