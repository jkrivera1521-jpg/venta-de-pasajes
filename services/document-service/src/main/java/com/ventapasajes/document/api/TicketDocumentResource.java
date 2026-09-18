package com.ventapasajes.document.api;

import java.net.URI;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.document.api.dto.DocumentResponse;
import com.ventapasajes.document.api.dto.DownloadPayload;
import com.ventapasajes.document.api.dto.GenerateTicketDocumentRequest;
import com.ventapasajes.document.service.TicketDocumentService;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/document/documents")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "documents")
public class TicketDocumentResource {

    @Inject
    TicketDocumentService ticketDocumentService;

    @POST
    @Path("/tickets/{ticketId}")
    @Operation(summary = "Generate printable PDF ticket document.")
    @APIResponse(responseCode = "201", description = "Ticket document generated.")
    @APIResponse(responseCode = "400", description = "Invalid ticket document payload.")
    @APIResponse(responseCode = "409", description = "Document could not be generated.")
    public Response generateTicketDocument(
            @Parameter(required = true) @PathParam("ticketId") UUID ticketId,
            GenerateTicketDocumentRequest request) {
        DocumentResponse response = ticketDocumentService.generate(ticketId, request);
        return Response.created(URI.create("/api/v1/document/documents/" + response.documentId()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/{documentId}")
    @Operation(summary = "Return generated document metadata.")
    @APIResponse(responseCode = "200", description = "Document metadata returned.")
    @APIResponse(responseCode = "404", description = "Document was not found.")
    public DocumentResponse document(
            @Parameter(required = true) @PathParam("documentId") UUID documentId) {
        return ticketDocumentService.document(documentId);
    }

    @GET
    @Path("/{documentId}/download")
    @Produces("application/pdf")
    @Operation(summary = "Download generated PDF document.")
    @APIResponse(responseCode = "200", description = "PDF document returned.")
    @APIResponse(responseCode = "404", description = "Document was not found.")
    public Response download(
            @Parameter(required = true) @PathParam("documentId") UUID documentId) {
        DownloadPayload payload = ticketDocumentService.download(documentId);
        return Response.ok(payload.content(), payload.contentType())
                .header("Content-Disposition", "inline; filename=\"" + payload.fileName() + "\"")
                .build();
    }
}
