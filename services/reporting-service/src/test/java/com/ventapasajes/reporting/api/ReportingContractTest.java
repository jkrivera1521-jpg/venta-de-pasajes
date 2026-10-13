package com.ventapasajes.reporting.api;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class ReportingContractTest {

    @Test
    void reportResourcesDeclareRequiredEndpoints() throws IOException {
        String reports = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/reporting/api/ReportingReportResource.java"));
        String events = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/reporting/api/ReportingEventResource.java"));

        assertContains(reports, "@Path(\"/api/v1/reporting/reports\")");
        assertContains(reports, "@Path(\"/sales\")");
        assertContains(reports, "@Path(\"/passengers\")");
        assertContains(reports, "@Path(\"/sales/by-user\")");
        assertContains(reports, "@Path(\"/sales/by-bus\")");
        assertContains(events, "@Path(\"/api/v1/reporting/events\")");
        assertContains(events, "@Path(\"/ticket-sold\")");
        assertContains(events, "@Path(\"/ticket-cancelled\")");
    }

    @Test
    void readModelMigrationDeclaresFactsAndProcessedEvents() throws IOException {
        String migration = Files.readString(Path.of(
                "src/main/resources/db/migration/V1__reporting_read_model.sql"));

        assertContains(migration, "CREATE TABLE IF NOT EXISTS fact_ticket_sales");
        assertContains(migration, "CREATE TABLE IF NOT EXISTS processed_events");
        assertContains(migration, "route_id UUID");
        assertContains(migration, "origin_terminal_id UUID");
        assertContains(migration, "UNIQUE (source_service, event_id, consumer_name)");
    }

    @Test
    void servicesUseReadModelAndIdempotentEventConsumption() throws IOException {
        String queryService = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/reporting/service/ReportingQueryService.java"));
        String ingestionService = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/reporting/service/ReportingEventIngestionService.java"));

        assertContains(queryService, "FactTicketSale.<FactTicketSale>find");
        assertContains(queryService, "salesByUser");
        assertContains(ingestionService, "ProcessedEvent.alreadyProcessed");
        assertContains(ingestionService, "TicketSold");
        assertContains(ingestionService, "TicketCancelled");
    }

    private static void assertContains(String content, String expected) {
        assertTrue(content.contains(expected), () -> "Missing expected fragment: " + expected);
    }
}
