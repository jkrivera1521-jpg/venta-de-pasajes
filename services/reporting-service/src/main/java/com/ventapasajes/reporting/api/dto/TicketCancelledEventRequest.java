package com.ventapasajes.reporting.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TicketCancelledEventRequest(
        UUID eventId,
        String eventType,
        Integer schemaVersion,
        Instant occurredAt,
        String sourceService,
        UUID correlationId,
        UUID ticketId,
        String ticketNumber,
        Instant cancelledAt,
        UUID cancelledByUserId,
        String cancelledBy,
        String reason,
        BigDecimal refundAmount) {
}
