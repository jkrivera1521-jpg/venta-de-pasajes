package com.ventapasajes.ticketing.api.dto;

import java.util.UUID;

public record CreateReservationRequest(
        UUID dispatchDepartureId,
        String seatNumber,
        Integer holdMinutes,
        ReservationPassengerRequest passenger) {
}
