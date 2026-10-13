package com.ventapasajes.ticketing.api.dto;

import com.ventapasajes.ticketing.domain.DocumentType;
import com.ventapasajes.ticketing.domain.PassengerStatus;

public record PassengerRequest(
        DocumentType documentType,
        String documentNumber,
        String firstName,
        String lastName,
        String email,
        String phone,
        PassengerStatus status) {
}
