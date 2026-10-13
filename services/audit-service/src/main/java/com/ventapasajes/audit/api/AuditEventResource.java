package com.ventapasajes.audit.api;

import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.audit.api.dto.AuditEventPageResponse;
import com.ventapasajes.audit.api.dto.AuditEventRequest;
import com.ventapasajes.audit.api.dto.AuditEventResponse;
import com.ventapasajes.audit.api.dto.AuditIngestResponse;
import com.ventapasajes.audit.service.AuditEventService;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/audit/audit-events")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "audit-events")
public class AuditEventResource {

    @Inject
    AuditEventService auditEventService;

    @GET
    @Operation(summary = "Search immutable audit events.")
    @APIResponse(responseCode = "200", description = "Audit events returned.")
    public AuditEventPageResponse search(
            @QueryParam("occurred_from") String occurredFrom,
            @QueryParam("occurred_to") String occurredTo,
            @QueryParam("actor_user_id") UUID actorUserId,
            @QueryParam("resource_type") String resourceType,
            @QueryParam("resource_id") String resourceId,
            @QueryParam("action") String action,
            @QueryParam("correlation_id") UUID correlationId,
            @QueryParam("page") Integer page,
            @QueryParam("page_size") Integer pageSize) {
        return auditEventService.search(
                occurredFrom,
                occurredTo,
                actorUserId,
                resourceType,
                resourceId,
                action,
                correlationId,
                page,
                pageSize);
    }

    @POST
    @Operation(summary = "Record an immutable audit event.")
    @APIResponse(responseCode = "202", description = "Audit event accepted.")
    @APIResponse(responseCode = "400", description = "Invalid event payload.")
    public Response record(
            @HeaderParam("Idempotency-Key") String idempotencyKey,
            AuditEventRequest request) {
        AuditIngestResponse response = auditEventService.record(idempotencyKey, request);
        return Response.accepted(response).build();
    }

    @GET
    @Path("/{eventId}")
    @Operation(summary = "Get an audit event by source event id.")
    @APIResponse(responseCode = "200", description = "Audit event returned.")
    @APIResponse(responseCode = "404", description = "Audit event not found.")
    public AuditEventResponse getByEventId(@PathParam("eventId") UUID eventId) {
        return auditEventService.getByEventId(eventId);
    }
}
