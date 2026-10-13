package com.ventapasajes.ticketing.api.dto;

public record ProcessTicketDocumentsResponse(
        int inspectedEvents,
        int generatedDocuments,
        int failedAttempts,
        int skippedEvents,
        boolean integrationEnabled) {
}
