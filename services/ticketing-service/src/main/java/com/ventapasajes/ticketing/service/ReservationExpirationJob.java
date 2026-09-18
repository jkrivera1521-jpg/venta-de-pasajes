package com.ventapasajes.ticketing.service;

import java.time.Instant;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class ReservationExpirationJob {

    @ConfigProperty(name = "app.reservation.expiration-job.enabled", defaultValue = "true")
    boolean enabled;

    @Inject
    TicketingReservationService reservationService;

    @Scheduled(every = "{app.reservation.expiration-job.interval}")
    void expireDueReservations() {
        if (enabled) {
            reservationService.expireDueReservations(Instant.now());
        }
    }
}
