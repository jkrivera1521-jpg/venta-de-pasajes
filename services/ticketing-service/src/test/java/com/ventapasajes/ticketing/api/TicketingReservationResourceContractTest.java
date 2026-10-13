package com.ventapasajes.ticketing.api;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class TicketingReservationResourceContractTest {

    @Test
    void reservationResourceDeclaresRequiredEndpoints() throws IOException {
        String resource = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/ticketing/api/TicketingReservationResource.java"));

        assertContains(resource, "@Path(\"/api/v1/ticketing/reservations\")");
        assertContains(resource, "reserveSeat");
        assertContains(resource, "@Path(\"/{reservationId}\")");
        assertContains(resource, "@Path(\"/expire\")");
    }

    @Test
    void reservationServiceUsesPessimisticLockingAndOutboxEvents() throws IOException {
        String service = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/ticketing/service/TicketingReservationService.java"));

        assertContains(service, "LockModeType.PESSIMISTIC_WRITE");
        assertContains(service, "SeatReserved");
        assertContains(service, "SeatReservationExpired");
        assertContains(service, "DepartureSeatStatus.RESERVED");
        assertContains(service, "ReservationStatus.EXPIRED");
    }

    @Test
    void reservationExpirationJobIsScheduledAndConfigurable() throws IOException {
        String job = Files.readString(Path.of(
                "src/main/java/com/ventapasajes/ticketing/service/ReservationExpirationJob.java"));

        assertContains(job, "@Scheduled");
        assertContains(job, "app.reservation.expiration-job.enabled");
        assertContains(job, "expireDueReservations");
    }

    private static void assertContains(String content, String expected) {
        assertTrue(content.contains(expected), () -> "Missing expected fragment: " + expected);
    }
}
