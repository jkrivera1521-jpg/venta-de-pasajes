package com.ventapasajes.dispatch.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.ventapasajes.dispatch.api.ApiException;
import com.ventapasajes.dispatch.api.dto.SeatDefinitionRequest;
import com.ventapasajes.dispatch.domain.SeatPosition;

class BusFleetServiceTest {

    @Test
    void validateSeatDefinitionsAcceptsAConsecutiveLayoutAndSortsBySeatNumber() {
        List<BusFleetService.NormalizedSeat> seats = BusFleetService.validateSeatDefinitions(List.of(
                new SeatDefinitionRequest(2, "  Ventana 2  ", 1, 2, SeatPosition.AISLE, true),
                new SeatDefinitionRequest(1, null, 1, 1, SeatPosition.WINDOW, null),
                new SeatDefinitionRequest(3, "3", 1, 3, SeatPosition.MIDDLE, false)));

        assertEquals(3, seats.size());
        assertEquals(1, seats.get(0).seatNumber());
        assertEquals("1", seats.get(0).label());
        assertEquals(2, seats.get(1).seatNumber());
        assertEquals("Ventana 2", seats.get(1).label());
        assertEquals(false, seats.get(2).active());
    }

    @Test
    void validateSeatDefinitionsRejectsMissingConsecutiveNumbers() {
        assertThrows(ApiException.class, () -> BusFleetService.validateSeatDefinitions(List.of(
                new SeatDefinitionRequest(1, "1", 1, 1, SeatPosition.WINDOW, true),
                new SeatDefinitionRequest(3, "3", 1, 2, SeatPosition.AISLE, true))));
    }

    @Test
    void validateSeatDefinitionsRejectsDuplicatedSeatNumbers() {
        assertThrows(ApiException.class, () -> BusFleetService.validateSeatDefinitions(List.of(
                new SeatDefinitionRequest(1, "1", 1, 1, SeatPosition.WINDOW, true),
                new SeatDefinitionRequest(1, "1B", 1, 2, SeatPosition.AISLE, true))));
    }

    @Test
    void validateSeatDefinitionsRejectsDuplicatedCoordinates() {
        assertThrows(ApiException.class, () -> BusFleetService.validateSeatDefinitions(List.of(
                new SeatDefinitionRequest(1, "1", 1, 1, SeatPosition.WINDOW, true),
                new SeatDefinitionRequest(2, "2", 1, 1, SeatPosition.AISLE, true))));
    }

    @Test
    void validateSeatDefinitionsRejectsInvalidSeatFields() {
        assertThrows(ApiException.class, () -> BusFleetService.validateSeatDefinitions(List.of(
                new SeatDefinitionRequest(1, "1", 0, 1, SeatPosition.WINDOW, true))));
        assertThrows(ApiException.class, () -> BusFleetService.validateSeatDefinitions(List.of(
                new SeatDefinitionRequest(1, "1", 1, 0, SeatPosition.WINDOW, true))));
        assertThrows(ApiException.class, () -> BusFleetService.validateSeatDefinitions(List.of(
                new SeatDefinitionRequest(1, "1", 1, 1, null, true))));
    }
}
