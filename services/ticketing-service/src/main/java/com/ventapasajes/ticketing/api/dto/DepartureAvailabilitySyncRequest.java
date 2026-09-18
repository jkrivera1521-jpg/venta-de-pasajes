package com.ventapasajes.ticketing.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.SyncedDepartureStatus;

public record DepartureAvailabilitySyncRequest(
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
        Integer seatCount,
        List<DepartureSeatSyncRequest> seats,
        Instant sourceUpdatedAt) {
}
