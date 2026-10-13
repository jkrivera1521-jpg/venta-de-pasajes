package com.ventapasajes.identity.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;

@QuarkusTest
class PasswordHashServiceTest {

    @Inject
    PasswordHashService passwordHashService;

    @Test
    void hashesAndVerifiesPasswords() {
        String password = "Temporal-Password-2026";

        String hash = passwordHashService.hash(password);

        assertNotEquals(password, hash);
        assertTrue(passwordHashService.verify(password, hash));
        assertFalse(passwordHashService.verify("wrong-password", hash));
    }
}
