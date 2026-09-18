package com.ventapasajes.ticketing.service;

import java.util.Arrays;
import java.util.List;

import com.ventapasajes.ticketing.api.dto.TicketingOverviewResponse;
import com.ventapasajes.ticketing.api.dto.TicketingResourceResponse;
import com.ventapasajes.ticketing.domain.DepartureSeatStatus;
import com.ventapasajes.ticketing.domain.ReservationStatus;
import com.ventapasajes.ticketing.domain.TicketStatus;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class TicketingCatalogService {

    public TicketingOverviewResponse overview() {
        return new TicketingOverviewResponse(
                "ticketing-service",
                "ticketing",
                resources(),
                seatStatuses(),
                reservationStatuses(),
                ticketStatuses());
    }

    public List<TicketingResourceResponse> resources() {
        return List.of(
                new TicketingResourceResponse("passengers", "Pasajeros", "ticketing-service",
                        "Personas que compran, reservan o viajan con un boleto."),
                new TicketingResourceResponse("reservations", "Reservas", "ticketing-service",
                        "Separacion temporal de asiento antes de emitir un boleto."),
                new TicketingResourceResponse("departure_seats", "Asientos por salida", "ticketing-service",
                        "Disponibilidad transaccional de asientos para una salida concreta."),
                new TicketingResourceResponse("tickets", "Boletos", "ticketing-service",
                        "Documento operacional de venta y derecho de viaje."),
                new TicketingResourceResponse("synced_departures", "Salidas sincronizadas", "ticketing-service",
                        "Modelo de lectura local con los datos minimos de dispatch-service para calcular disponibilidad."),
                new TicketingResourceResponse("outbox_events", "Eventos pendientes", "ticketing-service",
                        "Eventos transaccionales pendientes de publicar."));
    }

    public List<String> seatStatuses() {
        return enumNames(DepartureSeatStatus.values());
    }

    public List<String> reservationStatuses() {
        return enumNames(ReservationStatus.values());
    }

    public List<String> ticketStatuses() {
        return enumNames(TicketStatus.values());
    }

    private static <T extends Enum<T>> List<String> enumNames(T[] values) {
        return Arrays.stream(values)
                .map(Enum::name)
                .toList();
    }
}
