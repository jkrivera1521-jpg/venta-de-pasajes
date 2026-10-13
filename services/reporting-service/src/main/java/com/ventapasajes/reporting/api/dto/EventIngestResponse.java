package com.ventapasajes.reporting.api.dto;

import java.util.UUID;

public record EventIngestResponse(
        UUID eventId,
        String eventType,
        String status,
        boolean processed,
        UUID ticketId) {
}
