package com.ventapasajes.ticketing.api;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class TicketingTicketResourceContractTest {

    @Test
    void ticketResourceDeclaresRequiredEndpoints() throws IOException {
        String resource = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/ticketing/api/TicketingTicketResource.java"));

        assertContains(resource, "@Path(\"/api/v1/ticketing/tickets\")");
        assertContains(resource, "issueTicket");
        assertContains(resource, "@Path(\"/{ticketId}\")");
        assertContains(resource, "@Path(\"/{ticketId}/document\")");
        assertContains(resource, "@Path(\"/{ticketId}/document/reprint\")");
        assertContains(resource, "@Path(\"/{ticketId}/cancel\")");
        assertContains(resource, "cancelTicket");
    }

    @Test
    void saleServiceUsesTransactionLockingAndTicketSoldEvent() throws IOException {
        String service = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/ticketing/service/TicketingSaleService.java"));

        assertContains(service, "LockModeType.PESSIMISTIC_WRITE");
        assertContains(service, "TicketSold");
        assertContains(service, "DepartureSeatStatus.SOLD");
        assertContains(service, "ReservationStatus.CONVERTED_TO_TICKET");
        assertContains(service, "TicketStatus.ISSUED");
    }

    @Test
    void saleServiceDeclaresTicketCancellationBehavior() throws IOException {
        String service = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/ticketing/service/TicketingSaleService.java"));

        assertContains(service, "TicketCancelled");
        assertContains(service, "TicketStatus.VOIDED");
        assertContains(service, "DepartureSeatStatus.AVAILABLE");
        assertContains(service, "cancellationReason");
        assertContains(service, "cancelledBy");
    }

    @Test
    void ticketDocumentResourceDeclaresReprintAndProcessingEndpoints() throws IOException {
        String resource = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/ticketing/api/TicketingTicketDocumentResource.java"));
        String service = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/ticketing/service/TicketDocumentIntegrationService.java"));

        assertContains(resource, "@Path(\"/api/v1/ticketing/documents\")");
        assertContains(resource, "@Path(\"/process-pending\")");
        assertContains(service, "TicketSold");
        assertContains(service, "DocumentGenerateRequest");
        assertContains(service, "TicketDocumentRef");
        assertContains(service, "maxAttempts");
        assertContains(service, "not exists");
        assertContains(service, "nextAttemptAt");
    }

    private static void assertContains(String content, String expected) {
        assertTrue(content.contains(expected), () -> "Missing expected fragment: " + expected);
    }
}
