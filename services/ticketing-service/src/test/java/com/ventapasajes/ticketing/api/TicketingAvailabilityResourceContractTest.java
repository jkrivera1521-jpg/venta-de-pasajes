package com.ventapasajes.ticketing.api;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class TicketingAvailabilityResourceContractTest {

    @Test
    void availabilityResourceDeclaresRequiredEndpoints() throws IOException {
        String resource = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/ticketing/api/TicketingAvailabilityResource.java"));

        assertContains(resource, "@Path(\"/api/v1/ticketing/availability\")");
        assertContains(resource, "@Path(\"/departures\")");
        assertContains(resource, "@Path(\"/departures/{dispatchDepartureId}/seats\")");
        assertContains(resource, "@Path(\"/sync/departures\")");
    }

    @Test
    void availabilityServiceUsesLocalReadModelAndSeatStates() throws IOException {
        String service = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/ticketing/service/TicketingAvailabilityService.java"));

        assertContains(service, "SyncedDeparture");
        assertContains(service, "DepartureSeatStatus.AVAILABLE");
        assertContains(service, "DepartureSeatStatus.RESERVED");
        assertContains(service, "DepartureSeatStatus.SOLD");
        assertContains(service, "DepartureSeatStatus.CANCELLED");
    }

    private static void assertContains(String content, String expected) {
        assertTrue(content.contains(expected), () -> "Missing expected fragment: " + expected);
    }
}
