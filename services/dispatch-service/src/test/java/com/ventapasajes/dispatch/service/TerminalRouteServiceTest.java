package com.ventapasajes.dispatch.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import com.ventapasajes.dispatch.api.ApiException;
import com.ventapasajes.dispatch.persistence.entity.Terminal;

class TerminalRouteServiceTest {

    @Test
    void validatePageAcceptsValidPagination() {
        TerminalRouteService.PageRequest pageRequest = TerminalRouteService.validatePage(2, 50);

        assertEquals(2, pageRequest.page());
        assertEquals(50, pageRequest.pageSize());
        assertEquals(1, pageRequest.pageIndex());
    }

    @Test
    void validatePageRejectsInvalidPagination() {
        assertThrows(ApiException.class, () -> TerminalRouteService.validatePage(0, 25));
        assertThrows(ApiException.class, () -> TerminalRouteService.validatePage(1, 0));
        assertThrows(ApiException.class, () -> TerminalRouteService.validatePage(1, 101));
    }

    @Test
    void requiredTextTrimsValueAndRejectsBlank() {
        assertEquals("Quitumbe", TerminalRouteService.requiredText("  Quitumbe  ", "name"));

        assertThrows(ApiException.class, () -> TerminalRouteService.requiredText("   ", "name"));
    }

    @Test
    void defaultRouteNameUsesOriginAndDestinationNames() {
        Terminal origin = new Terminal();
        origin.name = "Quito";
        Terminal destination = new Terminal();
        destination.name = "Guayaquil";

        assertEquals("Quito - Guayaquil", TerminalRouteService.defaultRouteName(origin, destination));
    }
}
