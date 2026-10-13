package com.ventapasajes.dispatch.api.dto;

public record TerminalCreateRequest(
        Integer legacyId,
        String localCode,
        String name,
        String managerName,
        String address,
        String phone,
        String email,
        Boolean active) {
}
