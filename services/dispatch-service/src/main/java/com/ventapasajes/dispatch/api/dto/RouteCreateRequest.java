package com.ventapasajes.dispatch.api.dto;

import java.util.UUID;

public record RouteCreateRequest(
        UUID originTerminalId,
        UUID destinationTerminalId,
        String name,
        Boolean active) {
}
