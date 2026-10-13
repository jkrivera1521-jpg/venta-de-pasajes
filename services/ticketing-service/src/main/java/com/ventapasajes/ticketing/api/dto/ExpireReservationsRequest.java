package com.ventapasajes.ticketing.api.dto;

import java.time.Instant;

public record ExpireReservationsRequest(
        Instant expiredBefore) {
}
