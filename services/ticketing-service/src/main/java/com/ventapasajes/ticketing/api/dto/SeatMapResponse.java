package com.ventapasajes.ticketing.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.SyncedDepartureStatus;

public record SeatMapResponse(
        UUID dispatchDepartureId,
        String routeName,
        String originTerminalName,
        String destinationTerminalName,
        Instant departureAt,
        SyncedDepartureStatus status,
        int totalSeats,
        int availableSeats,
        int reservedSeats,
        int soldSeats,
        int blockedSeats,
        int cancelledSeats,
        List<SeatAvailabilityResponse> seats) {
}
