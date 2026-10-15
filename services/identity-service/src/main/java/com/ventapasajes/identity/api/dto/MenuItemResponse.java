package com.ventapasajes.identity.api.dto;

import java.util.List;
import java.util.UUID;

public record MenuItemResponse(
        UUID id,
        String code,
        String label,
        String icon,
        String targetUrl,
        String manifestUrl,
        boolean informationalOnly,
        UUID parentId,
        int level,
        int sortOrder,
        boolean active,
        List<String> roles,
        List<MenuItemResponse> children) {
}
