package com.ventapasajes.dispatch.api.dto;

import java.util.UUID;

public record BusCreateRequest(
        Integer legacyId,
        String code,
        String plate,
        String description,
        String defaultDestination,
        UUID busTypeId,
        UUID terminalId,
        UUID seatLayoutId,
        Boolean active) {
}
