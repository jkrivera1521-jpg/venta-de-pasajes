package com.ventapasajes.dispatch.api.dto;

import java.util.UUID;

public record RouteUpdateRequest(
        UUID originTerminalId,
        UUID destinationTerminalId,
        String name,
        Boolean active) {
}
