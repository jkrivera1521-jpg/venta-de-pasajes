package com.ventapasajes.identity.persistence;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class IdentityMigrationContractTest {

    @Test
    void initialMigrationContainsRequiredIdentityModel() throws IOException {
        String sql = readMigration();

        assertContains(sql, "CREATE TABLE users");
        assertContains(sql, "CREATE TABLE local_credentials");
        assertContains(sql, "CREATE TABLE google_identities");
        assertContains(sql, "CREATE TABLE internal_profiles");
        assertContains(sql, "CREATE TABLE roles");
        assertContains(sql, "CREATE TABLE permissions");
        assertContains(sql, "CREATE TABLE authorized_identities");
        assertContains(sql, "password_hash");
        assertContains(sql, "status text NOT NULL");
        assertContains(sql, "failed_login_attempts");
        assertContains(sql, "password_changed_at");
    }

    private static String readMigration() throws IOException {
        try (InputStream stream = IdentityMigrationContractTest.class
                .getResourceAsStream("/db/migration/V1__identity_schema.sql")) {
            if (stream == null) {
                throw new IOException("Migration resource was not found.");
            }
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static void assertContains(String sql, String expected) {
        assertTrue(sql.contains(expected), () -> "Migration is missing: " + expected);
    }
}
