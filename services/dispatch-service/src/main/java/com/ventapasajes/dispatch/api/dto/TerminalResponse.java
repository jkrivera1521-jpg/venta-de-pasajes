package com.ventapasajes.dispatch.api.dto;

import java.time.Instant;
import java.util.UUID;

public record TerminalResponse(
        UUID id,
        Integer legacyId,
        String localCode,
        String name,
        String managerName,
        String address,
        String phone,
        String email,
        boolean active,
        Instant createdAt,
        Instant updatedAt) {
}
