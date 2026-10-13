package com.ventapasajes.reporting.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TicketSoldEventRequest(
        UUID eventId,
        String eventType,
        Integer schemaVersion,
        Instant occurredAt,
        String sourceService,
        UUID correlationId,
        UUID ticketId,
        Integer legacyId,
        String ticketNumber,
        UUID dispatchDepartureId,
        UUID routeId,
        UUID originTerminalId,
        UUID destinationTerminalId,
        UUID passengerId,
        String passengerName,
        String passengerDocumentType,
        String passengerDocumentNumber,
        String seatNumber,
        String seatPosition,
        BigDecimal fareAmount,
        String currency,
        String paymentMethod,
        UUID soldByUserId,
        String sellerDisplayName,
        String busCode,
        String busType,
        String origin,
        String destination,
        Instant departureAt,
        String routeName) {
}
