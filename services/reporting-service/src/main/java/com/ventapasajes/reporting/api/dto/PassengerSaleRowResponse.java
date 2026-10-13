package com.ventapasajes.reporting.api.dto;

import java.time.Instant;

public record PassengerSaleRowResponse(
        String passengerName,
        String documentNumber,
        String ticketNumber,
        Instant departureAt,
        String busCode,
        Integer seatNumber) {
}
