package com.ventapasajes.identity.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.ventapasajes.identity.api.ApiException;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;

@QuarkusTest
class JwtServiceTest {

    @Inject
    JwtService jwtService;

    @Test
    void issuesAndVerifiesInternalJwt() {
        UUID userId = UUID.randomUUID();
        AuthenticatedUser user = new AuthenticatedUser(
                userId,
                "admin",
                "admin@example.local",
                "Administrador",
                List.of("ADMIN"),
                List.of("identity.users.read"),
                null);

        String token = jwtService.issueAccessToken(user, UUID.randomUUID());

        assertEquals(3, token.split("\\.").length);
        assertEquals(userId, user.id());
        assertEquals("admin", user.login());
        assertTrue(user.hasPermission("identity.users.read"));
    }

    @Test
    void rejectsTamperedJwt() {
        AuthenticatedUser user = new AuthenticatedUser(
                UUID.randomUUID(),
                "admin",
                "admin@example.local",
                "Administrador",
                List.of("ADMIN"),
                List.of("identity.users.read"),
                null);

        String token = jwtService.issueAccessToken(user, UUID.randomUUID());

        assertThrows(ApiException.class, () -> jwtService.verify(token + "tampered"));
    }
}
