package com.ventapasajes.ticketing.api.dto;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.DepartureSeatStatus;
import com.ventapasajes.ticketing.domain.ReservationStatus;

public record ReservationResponse(
        UUID reservationId,
        String reservationCode,
        UUID passengerId,
        UUID dispatchDepartureId,
        UUID departureSeatId,
        String seatNumber,
        ReservationStatus status,
        Instant expiresAt,
        DepartureSeatStatus seatStatus,
        UUID eventId) {
}
