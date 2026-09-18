package com.ventapasajes.dispatch.api.dto;

import java.util.List;

public record SeatLayoutUpdateRequest(
        String name,
        List<SeatDefinitionRequest> seats,
        Boolean active) {
}
