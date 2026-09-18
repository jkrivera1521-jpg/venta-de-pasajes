package com.ventapasajes.dispatch.api.dto;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.dispatch.domain.DepartureStatus;

public record DepartureResponse(
        UUID id,
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
        DepartureStatus status,
        String notes,
        String cancellationReason,
        Instant cancelledAt,
        Instant createdAt,
        Instant updatedAt) {
}
