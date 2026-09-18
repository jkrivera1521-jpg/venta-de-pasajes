package com.ventapasajes.dispatch.api.dto;

import java.time.Instant;
import java.util.UUID;

public record BusTypeResponse(
        UUID id,
        Integer legacyId,
        String name,
        String description,
        boolean active,
        Instant createdAt,
        Instant updatedAt) {
}
