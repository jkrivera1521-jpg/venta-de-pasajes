package com.ventapasajes.ticketing.api;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class TicketingPassengerResourceContractTest {

    @Test
    void passengerResourceDeclaresCrudSearchAndHistoryEndpoints() throws IOException {
        String resource = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/ticketing/api/TicketingPassengerResource.java"));

        assertContains(resource, "@Path(\"/api/v1/ticketing/passengers\")");
        assertContains(resource, "createPassenger");
        assertContains(resource, "updatePassenger");
        assertContains(resource, "deactivatePassenger");
        assertContains(resource, "ticketHistory");
        assertContains(resource, "@QueryParam(\"document_number\")");
        assertContains(resource, "@QueryParam(\"q\")");
    }

    @Test
    void passengerServicePreventsDuplicatesAndLinksTicketHistory() throws IOException {
        String service = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/ticketing/service/TicketingPassengerService.java"));

        assertContains(service, "Passenger already exists for this document.");
        assertContains(service, "Passenger already exists for this email.");
        assertContains(service, "documentType = ?1 and documentNumber = ?2");
        assertContains(service, "email = ?1");
        assertContains(service, "Ticket.<Ticket>find(\"passengerId = ?1 order by issuedAt desc\"");
        assertContains(service, "PassengerStatus.INACTIVE");
    }

    private static void assertContains(String content, String expected) {
        assertTrue(content.contains(expected), () -> "Missing expected fragment: " + expected);
    }
}
