package com.ventapasajes.document.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import com.ventapasajes.document.api.dto.DocumentResponse;
import com.ventapasajes.document.api.dto.DownloadPayload;
import com.ventapasajes.document.api.dto.GenerateTicketDocumentRequest;
import com.ventapasajes.document.api.dto.StoredDocument;
import com.ventapasajes.document.api.dto.TicketDocumentData;
import com.ventapasajes.document.domain.DocumentStatus;
import com.ventapasajes.document.domain.DocumentType;
import com.ventapasajes.document.persistence.entity.GeneratedDocument;
import com.ventapasajes.document.persistence.entity.OutboxEvent;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;

@ApplicationScoped
public class TicketDocumentService {

    private static final String DEFAULT_TEMPLATE_CODE = "DEFAULT_TICKET";

    @Inject
    TicketHtmlTemplateRenderer htmlTemplateRenderer;

    @Inject
    TicketPdfRenderer pdfRenderer;

    @Inject
    DocumentStorageService storageService;

    @Transactional
    public DocumentResponse generate(UUID ticketId, GenerateTicketDocumentRequest request) {
        if (ticketId == null) {
            throw new BadRequestException("ticketId is required.");
        }

        GeneratedDocument existing = GeneratedDocument.findTicketDocument(ticketId);
        if (existing != null && existing.status == DocumentStatus.GENERATED) {
            return toResponse(existing, null);
        }

        GenerateTicketDocumentRequest normalized = normalize(request);
        TicketDocumentData ticket = normalized.ticket();
        String templateCode = templateCode(normalized.templateCode());
        Instant generatedAt = Instant.now();

        String html = htmlTemplateRenderer.render(ticket);
        byte[] pdf = pdfRenderer.render(ticket, html);
        String fileName = safeFileName(ticket.ticketNumber()) + ".pdf";
        String objectName = "tickets/" + ticketId + "/" + fileName;
        StoredDocument stored = storageService.storePdf(objectName, fileName, pdf);

        GeneratedDocument document = existing == null ? new GeneratedDocument() : existing;
        document.ownerType = DocumentType.TICKET;
        document.ownerId = ticketId;
        document.type = DocumentType.TICKET;
        document.templateCode = templateCode;
        document.status = DocumentStatus.GENERATED;
        document.storageProvider = stored.provider();
        document.storageUri = stored.storageUri();
        document.contentType = stored.contentType();
        document.fileName = stored.fileName();
        document.checksumSha256 = stored.checksumSha256();
        document.sizeBytes = stored.sizeBytes();
        document.requestedByUserId = normalized.requestedByUserId();
        document.correlationId = normalized.correlationId() == null ? UUID.randomUUID() : normalized.correlationId();
        document.ticketNumber = ticket.ticketNumber();
        document.passengerName = ticket.passengerName();
        document.routeName = routeName(ticket);
        document.generatedAt = generatedAt;
        document.failureReason = null;
        document.persistAndFlush();

        UUID eventId = persistDocumentGeneratedEvent(document, ticket, generatedAt);
        return toResponse(document, eventId);
    }

    @Transactional
    public DocumentResponse document(UUID documentId) {
        GeneratedDocument document = GeneratedDocument.findById(documentId);
        if (document == null) {
            throw new NotFoundException("Document was not found.");
        }
        return toResponse(document, null);
    }

    @Transactional
    public DownloadPayload download(UUID documentId) {
        GeneratedDocument document = GeneratedDocument.findById(documentId);
        if (document == null) {
            throw new NotFoundException("Document was not found.");
        }
        if (document.status != DocumentStatus.GENERATED || document.storageUri == null) {
            throw new NotFoundException("Generated PDF was not found.");
        }
        return storageService.readPdf(document.storageProvider, document.storageUri, document.fileName);
    }

    private UUID persistDocumentGeneratedEvent(GeneratedDocument document, TicketDocumentData ticket, Instant occurredAt) {
        UUID eventId = UUID.randomUUID();
        Map<String, Object> payload = eventEnvelope("DocumentGenerated", occurredAt);
        payload.put("event_id", eventId.toString());
        payload.put("document_id", document.id.toString());
        payload.put("owner_type", document.ownerType.name());
        payload.put("owner_id", document.ownerId.toString());
        payload.put("ticket_number", ticket.ticketNumber());
        payload.put("template_code", document.templateCode);
        payload.put("storage_uri", document.storageUri);
        payload.put("content_type", document.contentType);
        payload.put("generated_at", occurredAt.toString());

        OutboxEvent event = new OutboxEvent();
        event.eventId = eventId;
        event.eventType = "DocumentGenerated";
        event.aggregateType = "document";
        event.aggregateId = document.id;
        event.payload = payload;
        event.persist();
        return eventId;
    }

    private Map<String, Object> eventEnvelope(String eventType, Instant occurredAt) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event_type", eventType);
        payload.put("schema_version", 1);
        payload.put("occurred_at", occurredAt.toString());
        payload.put("source_service", "document-service");
        payload.put("correlation_id", UUID.randomUUID().toString());
        return payload;
    }

    private DocumentResponse toResponse(GeneratedDocument document, UUID eventId) {
        return new DocumentResponse(
                document.id,
                document.ownerType.name(),
                document.ownerId,
                document.type.name(),
                document.status,
                document.templateCode,
                document.storageProvider,
                document.storageUri,
                "/api/v1/document/documents/" + document.id + "/download",
                document.contentType,
                document.fileName,
                document.checksumSha256,
                document.sizeBytes,
                document.ticketNumber,
                document.passengerName,
                document.routeName,
                document.createdAt,
                document.generatedAt,
                document.failureReason,
                eventId);
    }

    private static GenerateTicketDocumentRequest normalize(GenerateTicketDocumentRequest request) {
        if (request == null || request.ticket() == null) {
            throw new BadRequestException("ticket payload is required.");
        }

        TicketDocumentData ticket = request.ticket();
        requireText(ticket.ticketNumber(), "ticket.ticketNumber");
        requireText(ticket.passengerName(), "ticket.passengerName");
        requireText(ticket.documentNumber(), "ticket.documentNumber");
        requireText(ticket.origin(), "ticket.origin");
        requireText(ticket.destination(), "ticket.destination");
        requireText(ticket.seatNumber(), "ticket.seatNumber");
        if (ticket.price() == null || ticket.price().signum() < 0) {
            throw new BadRequestException("ticket.price must be greater than or equal to 0.");
        }
        if (ticket.departureAt() == null) {
            throw new BadRequestException("ticket.departureAt is required.");
        }

        TicketDocumentData normalizedTicket = new TicketDocumentData(
                ticket.ticketNumber().trim(),
                ticket.passengerName().trim(),
                blankToDefault(ticket.documentType(), "CEDULA"),
                ticket.documentNumber().trim(),
                ticket.price(),
                blankToDefault(ticket.currency(), "USD").toUpperCase(),
                blankToDefault(ticket.busCode(), "-"),
                blankToDefault(ticket.busType(), "-"),
                ticket.origin().trim(),
                ticket.destination().trim(),
                ticket.departureAt(),
                ticket.seatNumber().trim(),
                blankToDefault(ticket.seatPosition(), ""),
                ticket.soldAt() == null ? Instant.now() : ticket.soldAt());

        return new GenerateTicketDocumentRequest(
                templateCode(request.templateCode()),
                request.requestedByUserId(),
                request.correlationId(),
                normalizedTicket);
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(field + " is required.");
        }
        return value.trim();
    }

    private static String blankToDefault(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value.trim();
    }

    private static String templateCode(String templateCode) {
        return templateCode == null || templateCode.isBlank() ? DEFAULT_TEMPLATE_CODE : templateCode.trim().toUpperCase();
    }

    private static String routeName(TicketDocumentData ticket) {
        return ticket.origin() + " - " + ticket.destination();
    }

    private static String safeFileName(String value) {
        String safe = value == null ? "ticket" : value.trim().replaceAll("[^a-zA-Z0-9._-]+", "-");
        return safe.isBlank() ? "ticket" : safe;
    }
}
