package com.ventapasajes.ticketing.api.dto;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.DocumentType;
import com.ventapasajes.ticketing.domain.PassengerStatus;

public record PassengerResponse(
        UUID passengerId,
        Integer legacyId,
        DocumentType documentType,
        String documentNumber,
        String firstName,
        String lastName,
        String email,
        String phone,
        PassengerStatus status,
        long ticketCount,
        Instant createdAt,
        Instant updatedAt) {
}
