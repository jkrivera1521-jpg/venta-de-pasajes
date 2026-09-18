package com.ventapasajes.ticketing.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.TicketStatus;

public record TicketResponse(
        UUID ticketId,
        String ticketNumber,
        UUID passengerId,
        UUID reservationId,
        UUID dispatchDepartureId,
        UUID departureSeatId,
        String seatNumber,
        BigDecimal fareAmount,
        String currency,
        TicketStatus status,
        Instant issuedAt,
        Instant cancelledAt,
        String cancellationReason,
        String cancelledBy,
        UUID eventId) {
}
