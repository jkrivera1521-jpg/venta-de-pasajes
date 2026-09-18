package com.ventapasajes.identity.api.dto;

import java.util.List;

public record RoleCreateRequest(
        String code,
        String name,
        String description,
        List<String> permissionCodes) {
}
