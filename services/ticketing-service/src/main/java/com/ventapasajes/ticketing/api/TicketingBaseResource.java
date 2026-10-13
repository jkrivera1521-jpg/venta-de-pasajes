package com.ventapasajes.ticketing.api;

import java.util.List;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.ticketing.api.dto.TicketingOverviewResponse;
import com.ventapasajes.ticketing.api.dto.TicketingResourceResponse;
import com.ventapasajes.ticketing.service.TicketingCatalogService;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/v1/ticketing")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "ticketing")
public class TicketingBaseResource {

    @Inject
    TicketingCatalogService catalogService;

    @GET
    @Operation(summary = "Return ticketing domain overview.")
    @APIResponse(responseCode = "200", description = "Ticketing overview returned.")
    public TicketingOverviewResponse overview() {
        return catalogService.overview();
    }

    @GET
    @Path("/resources")
    @Operation(summary = "Return managed ticketing resources.")
    @APIResponse(responseCode = "200", description = "Managed resources returned.")
    public List<TicketingResourceResponse> resources() {
        return catalogService.resources();
    }

    @GET
    @Path("/seat-statuses")
    @Operation(summary = "Return available departure seat statuses.")
    @APIResponse(responseCode = "200", description = "Seat statuses returned.")
    public List<String> seatStatuses() {
        return catalogService.seatStatuses();
    }

    @GET
    @Path("/reservation-statuses")
    @Operation(summary = "Return available reservation statuses.")
    @APIResponse(responseCode = "200", description = "Reservation statuses returned.")
    public List<String> reservationStatuses() {
        return catalogService.reservationStatuses();
    }

    @GET
    @Path("/ticket-statuses")
    @Operation(summary = "Return available ticket statuses.")
    @APIResponse(responseCode = "200", description = "Ticket statuses returned.")
    public List<String> ticketStatuses() {
        return catalogService.ticketStatuses();
    }
}
