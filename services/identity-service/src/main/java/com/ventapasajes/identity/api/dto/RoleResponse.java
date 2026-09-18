package com.ventapasajes.identity.api.dto;

import java.util.List;
import java.util.UUID;

public record RoleResponse(
        UUID id,
        String code,
        String name,
        String description,
        boolean active,
        List<String> permissions) {
}
