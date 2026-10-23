package com.ventapasajes.report.auth;

import java.util.List;

public record AuthenticatedUser(
        String subject,
        String login,
        String email,
        String displayName,
        List<String> roles,
        List<String> permissions) {

    public boolean hasPermission(String permission) {
        if (permissions == null) {
            return false;
        }
        return permissions.stream().anyMatch(value -> value.equals(permission)
                || value.equalsIgnoreCase(permission)
                || value.equalsIgnoreCase(permission.replace('_', '.')));
    }

    public String actor() {
        if (login != null && !login.isBlank()) return login.trim();
        if (email != null && !email.isBlank()) return email.trim();
        if (subject != null && !subject.isBlank()) return subject.trim();
        return "desconocido";
    }
}
