package com.ventapasajes.dispatch.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.ventapasajes.dispatch.api.ApiException;
import com.ventapasajes.dispatch.domain.DepartureStatus;

class DepartureScheduleServiceTest {

    @Test
    void validatePageAcceptsValidPagination() {
        DepartureScheduleService.PageRequest pageRequest = DepartureScheduleService.validatePage(3, 20);

        assertEquals(3, pageRequest.page());
        assertEquals(20, pageRequest.pageSize());
        assertEquals(2, pageRequest.pageIndex());
    }

    @Test
    void validatePageRejectsInvalidPagination() {
        assertThrows(ApiException.class, () -> DepartureScheduleService.validatePage(0, 25));
        assertThrows(ApiException.class, () -> DepartureScheduleService.validatePage(1, 0));
        assertThrows(ApiException.class, () -> DepartureScheduleService.validatePage(1, 101));
    }

    @Test
    void validateDateRangeRejectsDateToBeforeDateFrom() {
        assertDoesNotThrow(() -> DepartureScheduleService.validateDateRange(
                LocalDate.of(2026, 9, 10),
                LocalDate.of(2026, 9, 10)));

        assertThrows(ApiException.class, () -> DepartureScheduleService.validateDateRange(
                LocalDate.of(2026, 9, 11),
                LocalDate.of(2026, 9, 10)));
    }

    @Test
    void requireFutureDepartureAtRejectsPastOrCurrentInstants() {
        assertDoesNotThrow(() -> DepartureScheduleService.requireFutureDepartureAt(Instant.now().plusSeconds(60)));

        assertThrows(ApiException.class, () -> DepartureScheduleService.requireFutureDepartureAt(null));
        assertThrows(ApiException.class, () -> DepartureScheduleService.requireFutureDepartureAt(Instant.now().minusSeconds(60)));
    }

    @Test
    void blocksBusScheduleOnlyForScheduledAndClosedDepartures() {
        assertTrue(DepartureScheduleService.blocksBusSchedule(DepartureStatus.SCHEDULED));
        assertTrue(DepartureScheduleService.blocksBusSchedule(DepartureStatus.CLOSED));
        assertFalse(DepartureScheduleService.blocksBusSchedule(DepartureStatus.CANCELLED));
        assertFalse(DepartureScheduleService.blocksBusSchedule(DepartureStatus.DEPARTED));
    }
}
