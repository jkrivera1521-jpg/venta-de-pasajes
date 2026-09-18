package com.ventapasajes.ticketing.api.dto;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.DepartureSeatStatus;

public record SeatAvailabilityResponse(
        UUID seatId,
        String seatNumber,
        DepartureSeatStatus status,
        boolean available,
        UUID reservationId,
        UUID passengerId,
        Instant holdExpiresAt) {
}
