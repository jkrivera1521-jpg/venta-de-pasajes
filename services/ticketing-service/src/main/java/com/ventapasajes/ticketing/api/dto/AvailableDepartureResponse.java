package com.ventapasajes.ticketing.api.dto;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.SyncedDepartureStatus;

public record AvailableDepartureResponse(
        UUID dispatchDepartureId,
        Integer legacyId,
        UUID busId,
        String busCode,
        String busPlate,
        UUID routeId,
        String routeName,
        UUID originTerminalId,
        String originTerminalName,
        UUID destinationTerminalId,
        String destinationTerminalName,
        Instant departureAt,
        SyncedDepartureStatus status,
        int totalSeats,
        int availableSeats,
        int reservedSeats,
        int soldSeats,
        int blockedSeats,
        int cancelledSeats,
        boolean sellable,
        Instant syncedAt) {
}
