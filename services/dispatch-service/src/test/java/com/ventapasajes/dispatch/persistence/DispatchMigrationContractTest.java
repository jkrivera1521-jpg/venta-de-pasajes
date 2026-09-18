package com.ventapasajes.dispatch.persistence;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class DispatchMigrationContractTest {

    @Test
    void initialMigrationDefinesDispatchTablesAndConstraints() throws IOException {
        String sql = readMigration("/db/migration/V1__dispatch_schema.sql");

        assertContains(sql, "CREATE TABLE terminals");
        assertContains(sql, "CREATE TABLE routes");
        assertContains(sql, "CREATE TABLE bus_types");
        assertContains(sql, "CREATE TABLE seat_layouts");
        assertContains(sql, "CREATE TABLE seat_layout_seats");
        assertContains(sql, "CREATE TABLE buses");
        assertContains(sql, "CREATE TABLE departures");
        assertContains(sql, "CREATE TABLE outbox_events");
        assertContains(sql, "CONSTRAINT ck_routes_different_terminals");
        assertContains(sql, "CONSTRAINT ck_departures_cancelled_fields");
        assertContains(sql, "CREATE UNIQUE INDEX uq_departures_bus_time_active");
        assertContains(sql, "CREATE INDEX idx_outbox_events_pending");
    }

    @Test
    void secondMigrationSeedsLegacy25SeatLayout() throws IOException {
        String sql = readMigration("/db/migration/V2__dispatch_seed_legacy_25_seat_layout.sql");

        assertContains(sql, "Legacy 25 asientos");
        assertContains(sql, "VALUES ('00000000-0000-0000-0000-000000000025', 'Legacy 25 asientos', 25");
        assertContains(sql, "(1, '1', 2, 1, 'WINDOW')");
        assertContains(sql, "(25, '25', 7, 3, 'MIDDLE')");
        assertContains(sql, "ON CONFLICT (seat_layout_id, seat_number) DO NOTHING");
    }

    private static String readMigration(String resourcePath) throws IOException {
        try (InputStream stream = DispatchMigrationContractTest.class
                .getResourceAsStream(resourcePath)) {
            if (stream == null) {
                throw new IOException("Dispatch migration resource was not found: " + resourcePath);
            }
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static void assertContains(String sql, String expected) {
        assertTrue(sql.contains(expected), () -> "Missing expected SQL fragment: " + expected);
    }
}
