package com.ventapasajes.reporting.api;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.reporting.api.dto.EventIngestResponse;
import com.ventapasajes.reporting.api.dto.TicketCancelledEventRequest;
import com.ventapasajes.reporting.api.dto.TicketSoldEventRequest;
import com.ventapasajes.reporting.service.ReportingEventIngestionService;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/v1/reporting/events")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "events")
public class ReportingEventResource {

    @Inject
    ReportingEventIngestionService ingestionService;

    @POST
    @Path("/ticket-sold")
    @Operation(summary = "Consume a TicketSold event into the reporting read model.")
    @APIResponse(responseCode = "200", description = "TicketSold event consumed.")
    @APIResponse(responseCode = "400", description = "Invalid event payload.")
    public EventIngestResponse ticketSold(TicketSoldEventRequest request) {
        return ingestionService.ingestTicketSold(request);
    }

    @POST
    @Path("/ticket-cancelled")
    @Operation(summary = "Consume a TicketCancelled event into the reporting read model.")
    @APIResponse(responseCode = "200", description = "TicketCancelled event consumed.")
    @APIResponse(responseCode = "400", description = "Invalid event payload.")
    @APIResponse(responseCode = "404", description = "Ticket sale was not found in the read model.")
    public EventIngestResponse ticketCancelled(TicketCancelledEventRequest request) {
        return ingestionService.ingestTicketCancelled(request);
    }
}
