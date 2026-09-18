package com.ventapasajes.ticketing.api;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.ticketing.api.dto.PassengerRequest;
import com.ventapasajes.ticketing.api.dto.PassengerResponse;
import com.ventapasajes.ticketing.api.dto.TicketResponse;
import com.ventapasajes.ticketing.domain.DocumentType;
import com.ventapasajes.ticketing.domain.PassengerStatus;
import com.ventapasajes.ticketing.service.TicketingPassengerService;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/ticketing/passengers")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "passengers")
public class TicketingPassengerResource {

    @Inject
    TicketingPassengerService passengerService;

    @GET
    @Operation(summary = "Search passengers by document, name or status.")
    @APIResponse(responseCode = "200", description = "Passengers returned.")
    public List<PassengerResponse> passengers(
            @QueryParam("document_type") DocumentType documentType,
            @QueryParam("document_number") String documentNumber,
            @QueryParam("q") String query,
            @QueryParam("status") PassengerStatus status) {
        return passengerService.search(documentType, documentNumber, query, status);
    }

    @POST
    @Operation(summary = "Create a passenger.")
    @APIResponse(responseCode = "201", description = "Passenger created.")
    @APIResponse(responseCode = "400", description = "Invalid passenger payload.")
    @APIResponse(responseCode = "409", description = "Passenger already exists for this document.")
    public Response createPassenger(PassengerRequest request) {
        PassengerResponse response = passengerService.create(request);
        return Response.created(URI.create("/api/v1/ticketing/passengers/" + response.passengerId()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/{passengerId}")
    @Operation(summary = "Return a passenger by id.")
    @APIResponse(responseCode = "200", description = "Passenger returned.")
    @APIResponse(responseCode = "404", description = "Passenger was not found.")
    public PassengerResponse passenger(
            @Parameter(required = true) @PathParam("passengerId") UUID passengerId) {
        return passengerService.passenger(passengerId);
    }

    @PUT
    @Path("/{passengerId}")
    @Operation(summary = "Update a passenger.")
    @APIResponse(responseCode = "200", description = "Passenger updated.")
    @APIResponse(responseCode = "400", description = "Invalid passenger payload.")
    @APIResponse(responseCode = "404", description = "Passenger was not found.")
    @APIResponse(responseCode = "409", description = "Passenger already exists for this document.")
    public PassengerResponse updatePassenger(
            @Parameter(required = true) @PathParam("passengerId") UUID passengerId,
            PassengerRequest request) {
        return passengerService.update(passengerId, request);
    }

    @DELETE
    @Path("/{passengerId}")
    @Operation(summary = "Deactivate a passenger.")
    @APIResponse(responseCode = "200", description = "Passenger deactivated.")
    @APIResponse(responseCode = "404", description = "Passenger was not found.")
    public PassengerResponse deactivatePassenger(
            @Parameter(required = true) @PathParam("passengerId") UUID passengerId) {
        return passengerService.deactivate(passengerId);
    }

    @GET
    @Path("/{passengerId}/tickets")
    @Operation(summary = "Return ticket history for a passenger.")
    @APIResponse(responseCode = "200", description = "Passenger ticket history returned.")
    @APIResponse(responseCode = "404", description = "Passenger was not found.")
    public List<TicketResponse> ticketHistory(
            @Parameter(required = true) @PathParam("passengerId") UUID passengerId) {
        return passengerService.ticketHistory(passengerId);
    }
}
