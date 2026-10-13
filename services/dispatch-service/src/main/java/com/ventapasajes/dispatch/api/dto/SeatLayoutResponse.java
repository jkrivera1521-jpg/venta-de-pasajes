package com.ventapasajes.dispatch.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SeatLayoutResponse(
        UUID id,
        String name,
        Integer seatCount,
        boolean active,
        List<SeatDefinitionResponse> seats,
        Instant createdAt,
        Instant updatedAt) {
}
