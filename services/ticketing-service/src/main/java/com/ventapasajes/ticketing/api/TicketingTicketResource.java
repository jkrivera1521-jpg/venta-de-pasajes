package com.ventapasajes.ticketing.api;

import java.net.URI;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.ticketing.api.dto.CreateTicketRequest;
import com.ventapasajes.ticketing.api.dto.CancelTicketRequest;
import com.ventapasajes.ticketing.api.dto.TicketDocumentResponse;
import com.ventapasajes.ticketing.api.dto.TicketResponse;
import com.ventapasajes.ticketing.service.TicketDocumentIntegrationService;
import com.ventapasajes.ticketing.service.TicketingSaleService;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/ticketing/tickets")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "tickets")
public class TicketingTicketResource {

    @Inject
    TicketingSaleService saleService;

    @Inject
    TicketDocumentIntegrationService documentIntegrationService;

    @POST
    @Operation(summary = "Issue a ticket from an available seat or a pending reservation.")
    @APIResponse(responseCode = "201", description = "Ticket issued.")
    @APIResponse(responseCode = "400", description = "Invalid ticket payload.")
    @APIResponse(responseCode = "404", description = "Departure, seat, reservation or ticket was not found.")
    @APIResponse(responseCode = "409", description = "Seat, departure or reservation is not available for sale.")
    public Response issueTicket(CreateTicketRequest request) {
        TicketResponse response = saleService.issueTicket(request);
        return Response.created(URI.create("/api/v1/ticketing/tickets/" + response.ticketId()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/{ticketId}")
    @Operation(summary = "Return a ticket by id.")
    @APIResponse(responseCode = "200", description = "Ticket returned.")
    @APIResponse(responseCode = "404", description = "Ticket was not found.")
    public TicketResponse ticket(
            @Parameter(required = true) @PathParam("ticketId") UUID ticketId) {
        return saleService.ticket(ticketId);
    }

    @GET
    @Path("/{ticketId}/document")
    @Operation(summary = "Return the generated document reference for a ticket.")
    @APIResponse(responseCode = "200", description = "Ticket document reference returned.")
    @APIResponse(responseCode = "404", description = "Ticket document reference was not found.")
    public TicketDocumentResponse ticketDocument(
            @Parameter(required = true) @PathParam("ticketId") UUID ticketId) {
        return documentIntegrationService.document(ticketId);
    }

    @POST
    @Path("/{ticketId}/document/reprint")
    @Consumes(MediaType.WILDCARD)
    @Operation(summary = "Return or regenerate the printable document reference for a ticket.")
    @APIResponse(responseCode = "200", description = "Ticket document reference ready for reprint.")
    @APIResponse(responseCode = "404", description = "Ticket or TicketSold event was not found.")
    @APIResponse(responseCode = "409", description = "Ticket document could not be generated.")
    public TicketDocumentResponse reprintTicketDocument(
            @Parameter(required = true) @PathParam("ticketId") UUID ticketId) {
        return documentIntegrationService.reprint(ticketId);
    }

    @POST
    @Path("/{ticketId}/cancel")
    @Operation(summary = "Cancel an issued ticket and release its seat when applicable.")
    @APIResponse(responseCode = "200", description = "Ticket cancelled.")
    @APIResponse(responseCode = "400", description = "Invalid cancellation payload.")
    @APIResponse(responseCode = "404", description = "Ticket or seat was not found.")
    @APIResponse(responseCode = "409", description = "Ticket cannot be cancelled from its current status.")
    public TicketResponse cancelTicket(
            @Parameter(required = true) @PathParam("ticketId") UUID ticketId,
            CancelTicketRequest request) {
        return saleService.cancelTicket(ticketId, request);
    }
}
