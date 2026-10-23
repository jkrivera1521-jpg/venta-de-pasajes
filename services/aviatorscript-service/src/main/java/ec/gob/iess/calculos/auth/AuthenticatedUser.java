package ec.gob.iess.calculos.auth;

import java.util.List;

/** Identity extracted from the signed token issued by identity-service. */
public record AuthenticatedUser(
        String subject,
        String login,
        String email,
        String displayName,
        List<String> roles,
        List<String> permissions) {

    public boolean hasPermission(String permission) {
        return permissions != null && permissions.contains(permission);
    }

    public String actor() {
        if (login != null && !login.isBlank()) {
            return login.trim();
        }
        if (email != null && !email.isBlank()) {
            return email.trim();
        }
        if (subject != null && !subject.isBlank()) {
            return subject.trim();
        }
        return "desconocido";
    }
}
