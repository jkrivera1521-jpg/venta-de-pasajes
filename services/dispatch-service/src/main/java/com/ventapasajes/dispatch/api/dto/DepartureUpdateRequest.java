package com.ventapasajes.dispatch.api.dto;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.dispatch.domain.DepartureStatus;

public record DepartureUpdateRequest(
        Integer legacyId,
        UUID busId,
        UUID routeId,
        Instant departureAt,
        DepartureStatus status,
        String notes) {
}
