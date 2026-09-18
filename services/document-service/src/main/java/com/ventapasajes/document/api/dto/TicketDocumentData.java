package com.ventapasajes.document.api.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record TicketDocumentData(
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
