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
                List.of("identity.users.read"));

        String token = jwtService.issueAccessToken(user);
        AuthenticatedUser verified = jwtService.verify(token);

        assertEquals(userId, verified.id());
        assertEquals("admin", verified.login());
        assertTrue(verified.hasPermission("identity.users.read"));
    }

    @Test
    void rejectsTamperedJwt() {
        AuthenticatedUser user = new AuthenticatedUser(
                UUID.randomUUID(),
                "admin",
                "admin@example.local",
                "Administrador",
                List.of("ADMIN"),
                List.of("identity.users.read"));

        String token = jwtService.issueAccessToken(user);

        assertThrows(ApiException.class, () -> jwtService.verify(token + "tampered"));
    }
}
