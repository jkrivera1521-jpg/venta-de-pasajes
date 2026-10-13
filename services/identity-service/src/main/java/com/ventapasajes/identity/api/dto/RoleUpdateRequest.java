package com.ventapasajes.identity.api.dto;

import java.util.List;

public record RoleUpdateRequest(
        String code,
        String name,
        String description,
        Boolean active,
        List<String> permissionCodes) {
}
