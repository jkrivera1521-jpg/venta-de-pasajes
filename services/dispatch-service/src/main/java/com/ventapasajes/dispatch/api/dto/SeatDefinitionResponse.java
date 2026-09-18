package com.ventapasajes.dispatch.api.dto;

import java.util.UUID;

import com.ventapasajes.dispatch.domain.SeatPosition;

public record SeatDefinitionResponse(
        UUID id,
        Integer seatNumber,
        String label,
        Integer rowNumber,
        Integer columnNumber,
        SeatPosition position,
        boolean active) {
}
