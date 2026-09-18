package com.ventapasajes.ticketing.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.ticketing.persistence.entity.DepartureSeat;
import com.ventapasajes.ticketing.persistence.entity.Passenger;
import com.ventapasajes.ticketing.persistence.entity.Reservation;

import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;

class TicketingTransactionConfigurationTest {

    @Test
    void reservationDraftRunsInsideTransaction() throws NoSuchMethodException {
        Method method = TicketingSaleService.class.getDeclaredMethod(
                "persistReservationDraft",
                Passenger.class,
                DepartureSeat.class,
                String.class,
                Instant.class);

        assertTrue(method.isAnnotationPresent(Transactional.class));
    }

    @Test
    void reservationCreationRunsInsideTransaction() throws NoSuchMethodException {
        Method method = TicketingReservationService.class.getDeclaredMethod(
                "reserveSeat",
                com.ventapasajes.ticketing.api.dto.CreateReservationRequest.class);

        assertTrue(method.isAnnotationPresent(Transactional.class));
    }

    @Test
    void ticketIssueRunsInsideTransaction() throws NoSuchMethodException {
        Method method = TicketingSaleService.class.getDeclaredMethod(
                "issueTicket",
                com.ventapasajes.ticketing.api.dto.CreateTicketRequest.class);

        assertTrue(method.isAnnotationPresent(Transactional.class));
    }

    @Test
    void ticketCancellationRunsInsideTransaction() throws NoSuchMethodException {
        Method method = TicketingSaleService.class.getDeclaredMethod(
                "cancelTicket",
                UUID.class,
                com.ventapasajes.ticketing.api.dto.CancelTicketRequest.class);

        assertTrue(method.isAnnotationPresent(Transactional.class));
    }

    @Test
    void ticketDraftPersistenceRunsInsideTransaction() throws NoSuchMethodException {
        Method method = TicketingSaleService.class.getDeclaredMethod(
                "persistTicketIssue",
                Passenger.class,
                DepartureSeat.class,
                Reservation.class,
                String.class,
                BigDecimal.class,
                UUID.class,
                UUID.class);

        assertTrue(method.isAnnotationPresent(Transactional.class));
    }
}
