package com.ventapasajes.ticketing.api.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateTicketRequest(
        UUID reservationId,
        UUID dispatchDepartureId,
        String seatNumber,
        BigDecimal fareAmount,
        String currency,
        ReservationPassengerRequest passenger) {
}
