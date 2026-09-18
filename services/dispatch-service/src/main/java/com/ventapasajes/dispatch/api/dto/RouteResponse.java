package com.ventapasajes.dispatch.api.dto;

import java.time.Instant;
import java.util.UUID;

public record RouteResponse(
        UUID id,
        UUID originTerminalId,
        String originTerminalName,
        UUID destinationTerminalId,
        String destinationTerminalName,
        String name,
        boolean active,
        Instant createdAt,
        Instant updatedAt) {
}
