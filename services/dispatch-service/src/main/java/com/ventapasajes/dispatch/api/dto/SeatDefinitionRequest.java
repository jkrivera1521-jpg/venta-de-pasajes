package com.ventapasajes.dispatch.api.dto;

import com.ventapasajes.dispatch.domain.SeatPosition;

public record SeatDefinitionRequest(
        Integer seatNumber,
        String label,
        Integer rowNumber,
        Integer columnNumber,
        SeatPosition position,
        Boolean active) {
}
