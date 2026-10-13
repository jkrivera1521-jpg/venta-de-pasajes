package com.ventapasajes.dispatch.api.dto;

public record BusTypeUpdateRequest(
        Integer legacyId,
        String name,
        String description,
        Boolean active) {
}
