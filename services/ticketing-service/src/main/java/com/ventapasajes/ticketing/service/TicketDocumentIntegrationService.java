package com.ventapasajes.ticketing.service;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.ticketing.api.dto.ProcessTicketDocumentsResponse;
import com.ventapasajes.ticketing.api.dto.TicketDocumentResponse;
import com.ventapasajes.ticketing.domain.TicketDocumentStatus;
import com.ventapasajes.ticketing.persistence.entity.OutboxEvent;
import com.ventapasajes.ticketing.persistence.entity.Passenger;
import com.ventapasajes.ticketing.persistence.entity.SyncedDeparture;
import com.ventapasajes.ticketing.persistence.entity.Ticket;
import com.ventapasajes.ticketing.persistence.entity.TicketDocumentRef;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.core.Response;

@ApplicationScoped
public class TicketDocumentIntegrationService {

    private static final String DEFAULT_TEMPLATE_CODE = "DEFAULT_TICKET";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(5))
            .build();

    @ConfigProperty(name = "app.documents.integration.enabled", defaultValue = "true")
    boolean integrationEnabled;

    @ConfigProperty(name = "app.documents.service-base-url")
    String documentServiceBaseUrl;

    @ConfigProperty(name = "app.documents.max-attempts", defaultValue = "3")
    int maxAttempts;

    @ConfigProperty(name = "app.documents.retry-delay-seconds", defaultValue = "30")
    long retryDelaySeconds;

    @Inject
    ObjectMapper objectMapper;

    @Transactional
    public ProcessTicketDocumentsResponse processPending(int limit) {
        if (!integrationEnabled) {
            return new ProcessTicketDocumentsResponse(0, 0, 0, 0, false);
        }

        Instant now = Instant.now();

        int normalizedLimit = limit <= 0 ? 10 : Math.min(limit, 100);
        List<OutboxEvent> events = OutboxEvent.<OutboxEvent>find(
                """
                        from OutboxEvent e
                        where e.eventType = ?1
                            and e.aggregateType = ?2
                            and (
                                not exists (
                                    select 1 from TicketDocumentRef ref
                                    where ref.sourceEventId = e.eventId
                                )
                                or exists (
                                    select 1 from TicketDocumentRef ref
                                    where ref.sourceEventId = e.eventId
                                        and ref.status <> ?3
                                        and ref.attempts < ?4
                                        and (ref.nextAttemptAt is null or ref.nextAttemptAt <= ?5)
                                )
                            )
                        order by e.createdAt
                        """,
                "TicketSold",
                "ticket",
                TicketDocumentStatus.GENERATED,
                maxAttempts,
                now)
                .page(0, normalizedLimit)
                .list();

        int generated = 0;
        int failed = 0;
        int skipped = 0;

        for (OutboxEvent event : events) {
            ProcessingResult result = processEvent(event, now, false);
            switch (result) {
                case GENERATED -> generated++;
                case FAILED -> failed++;
                case SKIPPED -> skipped++;
            }
        }

        return new ProcessTicketDocumentsResponse(events.size(), generated, failed, skipped, true);
    }

    @Transactional
    public TicketDocumentResponse document(UUID ticketId) {
        TicketDocumentRef ref = requireDocumentRef(ticketId);
        return toResponse(ref);
    }

    @Transactional
    public TicketDocumentResponse reprint(UUID ticketId) {
        if (!integrationEnabled) {
            throw new ServiceUnavailableException("Document integration is disabled.");
        }

        TicketDocumentRef ref = TicketDocumentRef.findByTicketId(ticketId);
        if (ref != null && ref.status == TicketDocumentStatus.GENERATED) {
            return toResponse(ref);
        }

        OutboxEvent event = OutboxEvent
                .<OutboxEvent>find("eventType = ?1 and aggregateType = ?2 and aggregateId = ?3",
                        "TicketSold",
                        "ticket",
                        ticketId)
                .firstResult();
        if (event == null) {
            throw new NotFoundException("TicketSold event was not found for this ticket.");
        }

        ProcessingResult result = processEvent(event, Instant.now(), true);
        ref = TicketDocumentRef.findByTicketId(ticketId);
        if (ref == null) {
            throw new ClientErrorException("Ticket document could not be generated.", Response.Status.CONFLICT);
        }
        if (result == ProcessingResult.FAILED || ref.status != TicketDocumentStatus.GENERATED) {
            throw new ClientErrorException("Ticket document could not be generated: " + ref.failureReason,
                    Response.Status.CONFLICT);
        }
        return toResponse(ref);
    }

    private ProcessingResult processEvent(OutboxEvent event, Instant now, boolean force) {
        Ticket ticket = Ticket.findById(event.aggregateId);
        if (ticket == null) {
            return ProcessingResult.SKIPPED;
        }

        TicketDocumentRef ref = TicketDocumentRef.findBySourceEventId(event.eventId);
        if (ref == null) {
            ref = TicketDocumentRef.findByTicketId(ticket.id);
        }
        if (ref == null) {
            ref = new TicketDocumentRef();
            ref.ticketId = ticket.id;
            ref.ticketNumber = ticket.ticketNumber;
            ref.sourceEventId = event.eventId;
            ref.status = TicketDocumentStatus.PENDING;
            ref.persist();
        }

        if (!force && ref.status == TicketDocumentStatus.GENERATED) {
            return ProcessingResult.SKIPPED;
        }
        if (!force && ref.attempts >= maxAttempts) {
            return ProcessingResult.SKIPPED;
        }
        if (!force && ref.nextAttemptAt != null && ref.nextAttemptAt.isAfter(now)) {
            return ProcessingResult.SKIPPED;
        }

        ref.attempts++;
        ref.lastAttemptAt = now;
        ref.status = TicketDocumentStatus.PENDING;
        ref.failureReason = null;

        try {
            DocumentServiceResponse document = requestDocument(ticket);
            ref.documentId = document.documentId();
            ref.documentEventId = document.eventId();
            ref.status = TicketDocumentStatus.GENERATED;
            ref.storageProvider = document.storageProvider();
            ref.storageUri = document.storageUri();
            ref.downloadUrl = absoluteDownloadUrl(document.downloadUrl());
            ref.contentType = document.contentType();
            ref.fileName = document.fileName();
            ref.checksumSha256 = document.checksumSha256();
            ref.sizeBytes = document.sizeBytes();
            ref.generatedAt = document.generatedAt() == null ? Instant.now() : document.generatedAt();
            ref.nextAttemptAt = null;
            ref.failureReason = null;
            return ProcessingResult.GENERATED;
        } catch (Exception ex) {
            ref.status = TicketDocumentStatus.FAILED;
            ref.failureReason = limit(ex.getMessage(), 1000);
            ref.nextAttemptAt = ref.attempts >= maxAttempts ? null : now.plusSeconds(retryDelaySeconds);
            return ProcessingResult.FAILED;
        }
    }

    private DocumentServiceResponse requestDocument(Ticket ticket) throws IOException, InterruptedException {
        Passenger passenger = Passenger.findById(ticket.passengerId);
        SyncedDeparture departure = SyncedDeparture
                .<SyncedDeparture>find("dispatchDepartureId = ?1", ticket.dispatchDepartureId)
                .firstResult();
        if (passenger == null) {
            throw new NotFoundException("Ticket passenger was not found.");
        }
        if (departure == null) {
            throw new NotFoundException("Ticket departure snapshot was not found.");
        }

        DocumentGenerateRequest request = new DocumentGenerateRequest(
                DEFAULT_TEMPLATE_CODE,
                null,
                UUID.randomUUID(),
                new DocumentTicketData(
                        ticket.ticketNumber,
                        passenger.firstName + " " + passenger.lastName,
                        passenger.documentType.name(),
                        passenger.documentNumber,
                        ticket.fareAmount,
                        ticket.currency,
                        departure.busCode,
                        null,
                        departure.originTerminalName,
                        departure.destinationTerminalName,
                        departure.departureAt,
                        ticket.seatNumber,
                        null,
                        ticket.issuedAt));

        String body = objectMapper.writeValueAsString(request);
        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(normalizedDocumentBaseUrl() + "/documents/tickets/" + ticket.id))
                .timeout(java.time.Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("document-service returned HTTP " + response.statusCode() + ": " + response.body());
        }
        return objectMapper.readValue(response.body(), DocumentServiceResponse.class);
    }

    private TicketDocumentRef requireDocumentRef(UUID ticketId) {
        TicketDocumentRef ref = TicketDocumentRef.findByTicketId(ticketId);
        if (ref == null) {
            throw new NotFoundException("Ticket document reference was not found.");
        }
        return ref;
    }

    private TicketDocumentResponse toResponse(TicketDocumentRef ref) {
        return new TicketDocumentResponse(
                ref.ticketId,
                ref.ticketNumber,
                ref.documentId,
                ref.sourceEventId,
                ref.documentEventId,
                ref.status,
                ref.storageProvider,
                ref.storageUri,
                ref.downloadUrl,
                ref.contentType,
                ref.fileName,
                ref.checksumSha256,
                ref.sizeBytes,
                ref.attempts,
                ref.lastAttemptAt,
                ref.nextAttemptAt,
                ref.generatedAt,
                ref.failureReason);
    }

    private String absoluteDownloadUrl(String downloadUrl) {
        if (downloadUrl == null || downloadUrl.isBlank()) {
            return null;
        }
        if (downloadUrl.startsWith("http://") || downloadUrl.startsWith("https://")) {
            return downloadUrl;
        }

        URI base = URI.create(normalizedDocumentBaseUrl());
        URI root = URI.create(base.getScheme() + "://" + base.getAuthority());
        return root.resolve(downloadUrl).toString();
    }

    private String normalizedDocumentBaseUrl() {
        return documentServiceBaseUrl.replaceAll("/+$", "");
    }

    private static String limit(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private enum ProcessingResult {
        GENERATED,
        FAILED,
        SKIPPED
    }

    private record DocumentGenerateRequest(
            String templateCode,
            UUID requestedByUserId,
            UUID correlationId,
            DocumentTicketData ticket) {
    }

    private record DocumentTicketData(
            String ticketNumber,
            String passengerName,
            String documentType,
            String documentNumber,
            BigDecimal price,
            String currency,
            String busCode,
            String busType,
            String origin,
            String destination,
            Instant departureAt,
            String seatNumber,
            String seatPosition,
            Instant soldAt) {
    }

    private record DocumentServiceResponse(
            UUID documentId,
            String ownerType,
            UUID ownerId,
            String type,
            String status,
            String templateCode,
            String storageProvider,
            String storageUri,
            String downloadUrl,
            String contentType,
            String fileName,
            String checksumSha256,
            Long sizeBytes,
            String ticketNumber,
            String passengerName,
            String routeName,
            Instant createdAt,
            Instant generatedAt,
            String failureReason,
            UUID eventId) {
    }
}
