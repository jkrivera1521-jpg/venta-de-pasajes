package com.ventapasajes.ticketing.persistence;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class TicketingMigrationContractTest {

    @Test
    void migrationDefinesInitialTicketingModel() throws IOException {
        String migration = readMigration("/db/migration/V1__ticketing_schema.sql");

        assertContains(migration, "CREATE EXTENSION IF NOT EXISTS pgcrypto");
        assertContains(migration, "CREATE EXTENSION IF NOT EXISTS citext");
        assertContains(migration, "CREATE TABLE IF NOT EXISTS passengers");
        assertContains(migration, "CREATE TABLE IF NOT EXISTS reservations");
        assertContains(migration, "CREATE TABLE IF NOT EXISTS departure_seats");
        assertContains(migration, "CREATE TABLE IF NOT EXISTS tickets");
        assertContains(migration, "CREATE TABLE IF NOT EXISTS outbox_events");
        assertContains(migration, "CREATE UNIQUE INDEX IF NOT EXISTS uq_passengers_email_not_null");
        assertContains(migration, "CREATE UNIQUE INDEX IF NOT EXISTS uq_tickets_active_departure_seat");
    }

    @Test
    void migrationDefinesAvailabilityReadModel() throws IOException {
        String migration = readMigration("/db/migration/V2__availability_read_model.sql");

        assertContains(migration, "CREATE TABLE IF NOT EXISTS synced_departures");
        assertContains(migration, "dispatch_departure_id UUID NOT NULL UNIQUE");
        assertContains(migration, "seat_count INTEGER NOT NULL CHECK (seat_count > 0)");
        assertContains(migration, "CREATE UNIQUE INDEX IF NOT EXISTS uq_synced_departures_legacy_id_not_null");
        assertContains(migration, "CREATE INDEX IF NOT EXISTS idx_synced_departures_terminals_time");
    }

    @Test
    void migrationDefinesReservationExpirationIndexes() throws IOException {
        String migration = readMigration("/db/migration/V3__reservation_expiration_indexes.sql");

        assertContains(migration, "CREATE INDEX IF NOT EXISTS idx_reservations_pending_expiration");
        assertContains(migration, "WHERE status = 'PENDING'");
        assertContains(migration, "CREATE INDEX IF NOT EXISTS idx_departure_seats_reservation_id");
        assertContains(migration, "CREATE INDEX IF NOT EXISTS idx_departure_seats_hold_expiration");
    }

    @Test
    void migrationDefinesTicketCancellationTrace() throws IOException {
        String migration = readMigration("/db/migration/V4__ticket_cancellation_trace.sql");

        assertContains(migration, "ADD COLUMN IF NOT EXISTS cancellation_reason");
        assertContains(migration, "ADD COLUMN IF NOT EXISTS cancelled_by");
        assertContains(migration, "CREATE INDEX IF NOT EXISTS idx_tickets_cancelled_at");
    }

    @Test
    void migrationDefinesPassengerSearchIndexes() throws IOException {
        String migration = readMigration("/db/migration/V5__passenger_search_indexes.sql");

        assertContains(migration, "CREATE INDEX IF NOT EXISTS idx_passengers_document_number");
        assertContains(migration, "CREATE INDEX IF NOT EXISTS idx_passengers_name_search");
        assertContains(migration, "CREATE INDEX IF NOT EXISTS idx_passengers_status_name");
    }

    @Test
    void migrationDefinesTicketDocumentReferences() throws IOException {
        String migration = readMigration("/db/migration/V6__ticket_document_refs.sql");

        assertContains(migration, "CREATE TABLE IF NOT EXISTS ticket_document_refs");
        assertContains(migration, "ticket_id UUID NOT NULL REFERENCES tickets(id)");
        assertContains(migration, "source_event_id UUID NOT NULL");
        assertContains(migration, "document_id UUID");
        assertContains(migration, "status VARCHAR(24) NOT NULL DEFAULT 'PENDING'");
        assertContains(migration, "CONSTRAINT uq_ticket_document_refs_ticket UNIQUE (ticket_id)");
        assertContains(migration, "CREATE INDEX IF NOT EXISTS idx_ticket_document_refs_status_retry");
    }

    private static String readMigration(String resourcePath) throws IOException {
        try (InputStream stream = TicketingMigrationContractTest.class.getResourceAsStream(resourcePath)) {
            assertNotNull(stream, resourcePath + " resource was not found.");
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static void assertContains(String migration, String expected) {
        assertTrue(migration.contains(expected), () -> "Missing expected SQL fragment: " + expected);
    }
}
