package com.ventapasajes.ticketing.api.dto;

import com.ventapasajes.ticketing.domain.DepartureSeatStatus;

public record DepartureSeatSyncRequest(
        String seatNumber,
        DepartureSeatStatus status) {
}
