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

    @Test
    void googleIdentitiesCompatibilityMigrationAddsAuditColumns() throws IOException {
        String sql = readMigration("/db/migration/V2__google_identities_audit_columns.sql");

        assertContains(sql, "ALTER TABLE google_identities");
        assertContains(sql, "ADD COLUMN IF NOT EXISTS created_at");
        assertContains(sql, "ADD COLUMN IF NOT EXISTS updated_at");
        assertContains(sql, "trg_google_identities_updated_at");
    }

    @Test
    void roleStatusLifecycleMigrationAddsOperationalStates() throws IOException {
        String sql = readMigration("/db/migration/V3__role_status_lifecycle.sql");

        assertContains(sql, "ALTER TABLE roles");
        assertContains(sql, "ADD COLUMN IF NOT EXISTS status");
        assertContains(sql, "'ACTIVE', 'DISABLED', 'DELETED'");
        assertContains(sql, "ck_roles_status");
    }

    @Test
    void publicGoogleCustomerRoleMigrationCreatesCustomerRole() throws IOException {
        String sql = readMigration("/db/migration/V4__public_google_customer_role.sql");

        assertContains(sql, "'CUSTOMER'");
        assertContains(sql, "identity_type = 'GOOGLE'");
        assertContains(sql, "seller_role.code = 'TICKET_SELLER'");
    }

    private static String readMigration() throws IOException {
        return readMigration("/db/migration/V1__identity_schema.sql");
    }

    private static String readMigration(String resourcePath) throws IOException {
        try (InputStream stream = IdentityMigrationContractTest.class
                .getResourceAsStream(resourcePath)) {
            if (stream == null) {
                throw new IOException("Migration resource was not found: " + resourcePath);
            }
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static void assertContains(String sql, String expected) {
        assertTrue(sql.contains(expected), () -> "Migration is missing: " + expected);
    }
}
