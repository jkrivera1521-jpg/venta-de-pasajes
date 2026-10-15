package com.ventapasajes.identity.api.dto;

import java.util.List;
import java.util.UUID;

public record CurrentUserResponse(
        UUID id,
        String identityType,
        String login,
        String email,
        String displayName,
        String avatarUrl,
        boolean darkMode,
        String status,
        List<String> roles,
        List<String> permissions) {
}
