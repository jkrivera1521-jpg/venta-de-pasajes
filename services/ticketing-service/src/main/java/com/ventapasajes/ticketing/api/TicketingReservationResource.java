package com.ventapasajes.ticketing.api;

import java.net.URI;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.ticketing.api.dto.CreateReservationRequest;
import com.ventapasajes.ticketing.api.dto.ExpireReservationsRequest;
import com.ventapasajes.ticketing.api.dto.ExpiredReservationsResponse;
import com.ventapasajes.ticketing.api.dto.ReservationResponse;
import com.ventapasajes.ticketing.service.TicketingReservationService;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/ticketing/reservations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "reservations")
public class TicketingReservationResource {

    @Inject
    TicketingReservationService reservationService;

    @POST
    @Operation(summary = "Reserve a departure seat temporarily.")
    @APIResponse(responseCode = "201", description = "Seat reserved.")
    @APIResponse(responseCode = "400", description = "Invalid reservation payload.")
    @APIResponse(responseCode = "404", description = "Departure or seat was not found.")
    @APIResponse(responseCode = "409", description = "Seat or departure is not available.")
    public Response reserveSeat(CreateReservationRequest request) {
        ReservationResponse response = reservationService.reserveSeat(request);
        return Response.created(URI.create("/api/v1/ticketing/reservations/" + response.reservationId()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/{reservationId}")
    @Operation(summary = "Return a reservation by id.")
    @APIResponse(responseCode = "200", description = "Reservation returned.")
    @APIResponse(responseCode = "404", description = "Reservation was not found.")
    public ReservationResponse reservation(
            @Parameter(required = true) @PathParam("reservationId") UUID reservationId) {
        return reservationService.reservation(reservationId);
    }

    @POST
    @Path("/expire")
    @Operation(summary = "Expire pending reservations whose hold time has elapsed.")
    @APIResponse(responseCode = "200", description = "Expired reservations returned.")
    public ExpiredReservationsResponse expireReservations(ExpireReservationsRequest request) {
        return reservationService.expireDueReservations(request);
    }
}
