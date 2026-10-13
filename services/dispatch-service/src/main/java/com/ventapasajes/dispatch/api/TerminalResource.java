package com.ventapasajes.dispatch.api;

import java.net.URI;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.dispatch.api.dto.PageResponse;
import com.ventapasajes.dispatch.api.dto.TerminalCreateRequest;
import com.ventapasajes.dispatch.api.dto.TerminalResponse;
import com.ventapasajes.dispatch.api.dto.TerminalUpdateRequest;
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

@Path("/api/v1/dispatch/terminals")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "terminals")
public class TerminalResource {

    @Inject
    TerminalRouteService terminalRouteService;

    @GET
    @Operation(summary = "List terminals with search and filters.")
    @APIResponse(responseCode = "200", description = "Terminals returned.")
    public PageResponse<TerminalResponse> listTerminals(
            @QueryParam("page") @DefaultValue("1") int page,
            @QueryParam("page_size") @DefaultValue("25") int pageSize,
            @QueryParam("q") String q,
            @QueryParam("active") Boolean active) {
        return terminalRouteService.listTerminals(page, pageSize, q, active);
    }

    @POST
    @Operation(summary = "Create a terminal.")
    @APIResponse(responseCode = "201", description = "Terminal created.")
    @APIResponse(responseCode = "400", description = "Invalid terminal payload.")
    @APIResponse(responseCode = "409", description = "Terminal duplicate found.")
    public Response createTerminal(
            TerminalCreateRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        TerminalResponse response = terminalRouteService.createTerminal(request, auditContext(actorUserId, correlationId));
        return Response.created(URI.create("/api/v1/dispatch/terminals/" + response.id()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/{terminalId}")
    @Operation(summary = "Get a terminal.")
    @APIResponse(responseCode = "200", description = "Terminal returned.")
    @APIResponse(responseCode = "404", description = "Terminal not found.")
    public TerminalResponse getTerminal(
            @Parameter(required = true) @PathParam("terminalId") UUID terminalId) {
        return terminalRouteService.getTerminal(terminalId);
    }

    @PATCH
    @Path("/{terminalId}")
    @Operation(summary = "Update a terminal.")
    @APIResponse(responseCode = "200", description = "Terminal updated.")
    @APIResponse(responseCode = "400", description = "Invalid terminal payload.")
    @APIResponse(responseCode = "404", description = "Terminal not found.")
    @APIResponse(responseCode = "409", description = "Terminal duplicate found.")
    public TerminalResponse updateTerminal(
            @Parameter(required = true) @PathParam("terminalId") UUID terminalId,
            TerminalUpdateRequest request,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        return terminalRouteService.updateTerminal(terminalId, request, auditContext(actorUserId, correlationId));
    }

    @DELETE
    @Path("/{terminalId}")
    @Operation(summary = "Deactivate a terminal.")
    @APIResponse(responseCode = "204", description = "Terminal deactivated.")
    @APIResponse(responseCode = "404", description = "Terminal not found.")
    @APIResponse(responseCode = "409", description = "Terminal is in use.")
    public Response deactivateTerminal(
            @Parameter(required = true) @PathParam("terminalId") UUID terminalId,
            @HeaderParam("X-Actor-User-Id") String actorUserId,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        terminalRouteService.deactivateTerminal(terminalId, auditContext(actorUserId, correlationId));
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
