package com.ventapasajes.reporting.api.dto;

import java.time.Instant;
import java.util.UUID;

public record SaleRowResponse(
        UUID ticketId,
        String ticketNumber,
        Instant soldAt,
        String passengerName,
        String documentNumber,
        String busCode,
        String origin,
        String destination,
        Integer seatNumber,
        UUID sellerUserId,
        MoneyResponse amount,
        String status) {
}
