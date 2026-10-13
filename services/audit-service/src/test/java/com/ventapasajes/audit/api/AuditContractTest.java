package com.ventapasajes.audit.api;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class AuditContractTest {

    @Test
    void auditApiDeclaresCoreEndpoints() throws IOException {
        String resource = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/audit/api/AuditEventResource.java"));

        assertContains(resource, "@Path(\"/api/v1/audit/audit-events\")");
        assertContains(resource, "@GET");
        assertContains(resource, "@POST");
        assertContains(resource, "@Path(\"/{eventId}\")");
    }

    @Test
    void auditMigrationCreatesAppendOnlyTablesAndIndexes() throws IOException {
        String migration = Files.readString(Path.of(
                "src/main/resources/db/migration/V1__audit_schema.sql"));

        assertContains(migration, "CREATE TABLE IF NOT EXISTS audit_events");
        assertContains(migration, "CREATE TABLE IF NOT EXISTS processed_events");
        assertContains(migration, "CREATE TABLE IF NOT EXISTS outbox_events");
        assertContains(migration, "UNIQUE (source_service, source_event_id)");
        assertContains(migration, "idx_audit_events_occurred_at");
    }

    @Test
    void auditServiceUsesIdempotentSourceEvents() throws IOException {
        String service = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/audit/service/AuditEventService.java"));

        assertContains(service, "sourceService + \":\" + eventId");
        assertContains(service, "findBySourceEventId");
        assertContains(service, "AuditEventCreated");
    }

    private static void assertContains(String value, String expected) {
        assertTrue(value.contains(expected), () -> "Missing expected value: " + expected);
    }
}
