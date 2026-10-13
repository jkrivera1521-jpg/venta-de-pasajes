package com.ventapasajes.ticketing.api.dto;

import com.ventapasajes.ticketing.domain.DocumentType;

public record ReservationPassengerRequest(
        DocumentType documentType,
        String documentNumber,
        String firstName,
        String lastName,
        String email,
        String phone) {
}
