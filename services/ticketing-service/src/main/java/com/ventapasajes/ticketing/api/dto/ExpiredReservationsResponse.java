package com.ventapasajes.ticketing.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ExpiredReservationsResponse(
        Instant expiredBefore,
        int expiredReservations,
        List<UUID> reservationIds) {
}
