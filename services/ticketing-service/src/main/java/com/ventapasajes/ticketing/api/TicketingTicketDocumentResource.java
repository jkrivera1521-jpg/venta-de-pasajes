package com.ventapasajes.ticketing.api;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.ticketing.api.dto.ProcessTicketDocumentsResponse;
import com.ventapasajes.ticketing.service.TicketDocumentIntegrationService;

import jakarta.inject.Inject;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

@Path("/api/v1/ticketing/documents")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "ticket-documents")
public class TicketingTicketDocumentResource {

    @Inject
    TicketDocumentIntegrationService documentIntegrationService;

    @POST
    @Path("/process-pending")
    @Operation(summary = "Process pending TicketSold events and request ticket PDF generation.")
    @APIResponse(responseCode = "200", description = "Pending ticket document events processed.")
    public ProcessTicketDocumentsResponse processPendingTicketDocuments(
            @QueryParam("limit") Integer limit) {
        return documentIntegrationService.processPending(limit == null ? 10 : limit);
    }
}
