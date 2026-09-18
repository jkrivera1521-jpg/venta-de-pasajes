package com.ventapasajes.ticketing.api.dto;

public record CancelTicketRequest(
        String reason,
        String cancelledBy,
        Boolean releaseSeat) {
}
