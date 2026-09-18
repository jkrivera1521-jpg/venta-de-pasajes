package com.ventapasajes.dispatch.service;

import java.util.Arrays;
import java.util.List;

import com.ventapasajes.dispatch.api.dto.DispatchOverviewResponse;
import com.ventapasajes.dispatch.api.dto.DispatchResourceResponse;
import com.ventapasajes.dispatch.domain.DepartureStatus;
import com.ventapasajes.dispatch.domain.SeatPosition;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class DispatchCatalogService {

    private static final String BASE_PATH = "/api/v1/dispatch";

    private static final List<DispatchResourceResponse> RESOURCES = List.of(
            new DispatchResourceResponse("terminals", BASE_PATH + "/terminals", "Terminales terrestres."),
            new DispatchResourceResponse("routes", BASE_PATH + "/routes", "Rutas entre terminales."),
            new DispatchResourceResponse("bus_types", BASE_PATH + "/bus-types", "Tipos comerciales de bus."),
            new DispatchResourceResponse("seat_layouts", BASE_PATH + "/seat-layouts", "Distribuciones de asientos."),
            new DispatchResourceResponse("buses", BASE_PATH + "/buses", "Unidades fisicas de transporte."),
            new DispatchResourceResponse("departures", BASE_PATH + "/departures", "Salidas programadas."));

    public DispatchOverviewResponse overview() {
        return new DispatchOverviewResponse(
                "dispatch-service",
                "dispatch_db",
                BASE_PATH,
                resources(),
                departureStatuses(),
                seatPositions());
    }

    public List<DispatchResourceResponse> resources() {
        return RESOURCES;
    }

    public List<String> departureStatuses() {
        return Arrays.stream(DepartureStatus.values())
                .map(Enum::name)
                .toList();
    }

    public List<String> seatPositions() {
        return Arrays.stream(SeatPosition.values())
                .map(Enum::name)
                .toList();
    }
}
