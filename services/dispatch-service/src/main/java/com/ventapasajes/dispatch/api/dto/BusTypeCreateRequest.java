package com.ventapasajes.dispatch.api.dto;

public record BusTypeCreateRequest(
        Integer legacyId,
        String name,
        String description,
        Boolean active) {
}
