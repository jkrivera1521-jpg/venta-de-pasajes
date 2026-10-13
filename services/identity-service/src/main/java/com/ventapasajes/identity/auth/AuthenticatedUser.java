package com.ventapasajes.identity.auth;

import java.util.List;
import java.util.UUID;

public record AuthenticatedUser(
        UUID id,
        String login,
        String email,
        String displayName,
        List<String> roles,
        List<String> permissions) {

    public boolean hasPermission(String permission) {
        return permissions != null && permissions.contains(permission);
    }
}
