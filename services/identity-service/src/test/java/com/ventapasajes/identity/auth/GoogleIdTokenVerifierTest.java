package com.ventapasajes.identity.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.ventapasajes.identity.api.ApiException;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;

@QuarkusTest
class GoogleIdTokenVerifierTest {

    @Inject
    GoogleIdTokenVerifier googleIdTokenVerifier;

    @Test
    void validatesDevelopmentGoogleTokenWithExpectedAudience() {
        String token = googleIdTokenVerifier.createDevelopmentToken(
                "google-subject-1",
                "user@example.com",
                "Usuario Prueba",
                "test-google-client");

        GoogleIdTokenVerifier.GooglePrincipal principal = googleIdTokenVerifier.verify(token);

        assertEquals("google-subject-1", principal.subject());
        assertEquals("user@example.com", principal.email());
        assertTrue(principal.emailVerified());
    }

    @Test
    void rejectsDevelopmentGoogleTokenWithUnexpectedAudience() {
        String token = googleIdTokenVerifier.createDevelopmentToken(
                "google-subject-1",
                "user@example.com",
                "Usuario Prueba",
                "other-google-client");

        assertThrows(ApiException.class, () -> googleIdTokenVerifier.verify(token));
    }
}
