package com.ventapasajes.ticketing.api;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.ticketing.api.dto.AvailableDepartureResponse;
import com.ventapasajes.ticketing.api.dto.DepartureAvailabilitySyncRequest;
import com.ventapasajes.ticketing.api.dto.SeatMapResponse;
import com.ventapasajes.ticketing.service.TicketingAvailabilityService;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/ticketing/availability")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "availability")
public class TicketingAvailabilityResource {

    @Inject
    TicketingAvailabilityService availabilityService;

    @GET
    @Path("/departures")
    @Operation(summary = "List departures with sellable seats from the local ticketing read model.")
    @APIResponse(responseCode = "200", description = "Available departures returned.")
    public List<AvailableDepartureResponse> availableDepartures(
            @QueryParam("date_from") LocalDate dateFrom,
            @QueryParam("date_to") LocalDate dateTo,
            @QueryParam("origin_terminal_id") UUID originTerminalId,
            @QueryParam("destination_terminal_id") UUID destinationTerminalId,
            @QueryParam("route_id") UUID routeId) {
        return availabilityService.availableDepartures(dateFrom, dateTo, originTerminalId, destinationTerminalId, routeId);
    }

    @GET
    @Path("/departures/{dispatchDepartureId}/seats")
    @Operation(summary = "Return the seat map for a departure.")
    @APIResponse(responseCode = "200", description = "Seat map returned.")
    @APIResponse(responseCode = "404", description = "Departure was not found in the local read model.")
    public SeatMapResponse seatMap(
            @Parameter(required = true) @PathParam("dispatchDepartureId") UUID dispatchDepartureId) {
        return availabilityService.seatMap(dispatchDepartureId);
    }

    @POST
    @Path("/sync/departures")
    @Operation(summary = "Synchronize a dispatch departure into the local availability read model.")
    @APIResponse(responseCode = "201", description = "Departure synchronized.")
    @APIResponse(responseCode = "400", description = "Invalid synchronization payload.")
    public Response syncDeparture(DepartureAvailabilitySyncRequest request) {
        SeatMapResponse response = availabilityService.syncDeparture(request);
        return Response.created(URI.create("/api/v1/ticketing/availability/departures/"
                + response.dispatchDepartureId()
                + "/seats"))
                .entity(response)
                .build();
    }
}
