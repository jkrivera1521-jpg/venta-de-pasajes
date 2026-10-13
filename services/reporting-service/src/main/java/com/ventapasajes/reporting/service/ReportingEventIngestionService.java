package com.ventapasajes.reporting.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.reporting.api.dto.EventIngestResponse;
import com.ventapasajes.reporting.api.dto.TicketCancelledEventRequest;
import com.ventapasajes.reporting.api.dto.TicketSoldEventRequest;
import com.ventapasajes.reporting.persistence.entity.FactTicketSale;
import com.ventapasajes.reporting.persistence.entity.ProcessedEvent;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;

@ApplicationScoped
public class ReportingEventIngestionService {

    private static final String CONSUMER_NAME = "reporting-service";

    @Transactional
    public EventIngestResponse ingestTicketSold(TicketSoldEventRequest request) {
        TicketSoldEventRequest payload = requirePayload(request);
        UUID eventId = requireEventId(payload.eventId());
        UUID ticketId = requireUuid(payload.ticketId(), "ticketId");

        if (ProcessedEvent.alreadyProcessed(eventId, CONSUMER_NAME)) {
            return new EventIngestResponse(eventId, "TicketSold", "DUPLICATE", false, ticketId);
        }

        FactTicketSale sale = FactTicketSale.findById(ticketId);
        if (sale == null) {
            sale = new FactTicketSale();
            sale.ticketId = ticketId;
        }

        sale.legacyId = payload.legacyId();
        sale.ticketNumber = requireText(payload.ticketNumber(), "ticketNumber");
        sale.departureId = requireUuid(payload.dispatchDepartureId(), "dispatchDepartureId");
        sale.routeId = payload.routeId();
        sale.originTerminalId = payload.originTerminalId();
        sale.destinationTerminalId = payload.destinationTerminalId();
        sale.passengerId = payload.passengerId();
        sale.passengerName = normalizeNullable(payload.passengerName());
        sale.passengerDocumentType = normalizeNullable(payload.passengerDocumentType());
        sale.passengerDocumentNumber = normalizeNullable(payload.passengerDocumentNumber());
        sale.seatNumber = parseSeatNumber(payload.seatNumber());
        sale.seatPosition = normalizeNullable(payload.seatPosition());
        sale.price = payload.fareAmount() == null ? BigDecimal.ZERO : payload.fareAmount();
        sale.currency = normalizeCurrency(payload.currency());
        sale.paymentMethod = normalizeNullable(payload.paymentMethod());
        sale.status = "SOLD";
        sale.soldAt = payload.occurredAt() == null ? Instant.now() : payload.occurredAt();
        sale.soldByUserId = payload.soldByUserId();
        sale.sellerDisplayName = normalizeNullable(payload.sellerDisplayName());
        sale.cancelledAt = null;
        sale.cancelledByUserId = null;
        sale.cancellationReason = null;
        sale.refundAmount = null;
        sale.busCode = normalizeNullable(payload.busCode());
        sale.busType = normalizeNullable(payload.busType());
        sale.origin = firstNonBlank(payload.origin(), payload.routeName());
        sale.destination = normalizeNullable(payload.destination());
        sale.departureAt = payload.departureAt();
        sale.lastEventId = eventId;

        if (!sale.isPersistent()) {
            sale.persist();
        }
        persistProcessedEvent(eventId, "TicketSold", payload.schemaVersion(), payload.sourceService(), payload.correlationId(), null);

        return new EventIngestResponse(eventId, "TicketSold", "PROCESSED", true, ticketId);
    }

    @Transactional
    public EventIngestResponse ingestTicketCancelled(TicketCancelledEventRequest request) {
        TicketCancelledEventRequest payload = requirePayload(request);
        UUID eventId = requireEventId(payload.eventId());
        UUID ticketId = requireUuid(payload.ticketId(), "ticketId");

        if (ProcessedEvent.alreadyProcessed(eventId, CONSUMER_NAME)) {
            return new EventIngestResponse(eventId, "TicketCancelled", "DUPLICATE", false, ticketId);
        }

        FactTicketSale sale = FactTicketSale.findById(ticketId);
        if (sale == null) {
            throw new NotFoundException("Ticket sale was not found in reporting read model.");
        }

        sale.status = "CANCELLED";
        sale.cancelledAt = payload.cancelledAt() == null
                ? payload.occurredAt() == null ? Instant.now() : payload.occurredAt()
                : payload.cancelledAt();
        sale.cancelledByUserId = payload.cancelledByUserId();
        sale.cancellationReason = normalizeNullable(payload.reason());
        sale.refundAmount = payload.refundAmount() == null ? sale.price : payload.refundAmount();
        sale.lastEventId = eventId;

        persistProcessedEvent(eventId, "TicketCancelled", payload.schemaVersion(), payload.sourceService(),
                payload.correlationId(), null);

        return new EventIngestResponse(eventId, "TicketCancelled", "PROCESSED", true, ticketId);
    }

    private static void persistProcessedEvent(
            UUID eventId,
            String eventType,
            Integer schemaVersion,
            String sourceService,
            UUID correlationId,
            String error) {
        ProcessedEvent processed = new ProcessedEvent();
        processed.eventId = eventId;
        processed.eventType = eventType;
        processed.schemaVersion = schemaVersion == null ? 1 : schemaVersion;
        processed.sourceService = normalizeNullable(sourceService) == null ? "ticketing-service" : sourceService.trim();
        processed.consumerName = CONSUMER_NAME;
        processed.correlationId = correlationId;
        processed.status = error == null ? "PROCESSED" : "FAILED";
        processed.error = error;
        processed.persist();
    }

    private static UUID requireEventId(UUID eventId) {
        return requireUuid(eventId, "eventId");
    }

    private static UUID requireUuid(UUID value, String fieldName) {
        if (value == null) {
            throw new BadRequestException("Field is required: " + fieldName + ".");
        }
        return value;
    }

    private static String requireText(String value, String fieldName) {
        String normalized = normalizeNullable(value);
        if (normalized == null) {
            throw new BadRequestException("Field is required: " + fieldName + ".");
        }
        return normalized;
    }

    private static <T> T requirePayload(T payload) {
        if (payload == null) {
            throw new BadRequestException("Request body is required.");
        }
        return payload;
    }

    private static Integer parseSeatNumber(String value) {
        String normalized = normalizeNullable(value);
        if (normalized == null) {
            return null;
        }
        try {
            return Integer.valueOf(normalized);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String normalizeCurrency(String currency) {
        String normalized = normalizeNullable(currency);
        if (normalized == null) {
            return "USD";
        }
        normalized = normalized.toUpperCase();
        if (normalized.length() != 3) {
            throw new BadRequestException("currency must use a three-letter ISO code.");
        }
        return normalized;
    }

    private static String firstNonBlank(String first, String second) {
        String normalized = normalizeNullable(first);
        return normalized == null ? normalizeNullable(second) : normalized;
    }

    private static String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
