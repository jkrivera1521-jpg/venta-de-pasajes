package com.ventapasajes.dispatch.api.dto;

import java.time.Instant;
import java.util.UUID;

public record DepartureCreateRequest(
        Integer legacyId,
        UUID busId,
        UUID routeId,
        Instant departureAt,
        String notes) {
}
