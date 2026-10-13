package com.ventapasajes.dispatch.api.dto;

import java.time.Instant;
import java.util.UUID;

public record BusResponse(
        UUID id,
        Integer legacyId,
        String code,
        String plate,
        String description,
        String defaultDestination,
        UUID busTypeId,
        String busTypeName,
        UUID terminalId,
        String terminalName,
        UUID seatLayoutId,
        String seatLayoutName,
        Integer seatCount,
        boolean active,
        Instant createdAt,
        Instant updatedAt) {
}
