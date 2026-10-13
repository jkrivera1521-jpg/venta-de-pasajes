package com.ventapasajes.ticketing.api.dto;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.TicketDocumentStatus;

public record TicketDocumentResponse(
        UUID ticketId,
        String ticketNumber,
        UUID documentId,
        UUID sourceEventId,
        UUID documentEventId,
        TicketDocumentStatus status,
        String storageProvider,
        String storageUri,
        String downloadUrl,
        String contentType,
        String fileName,
        String checksumSha256,
        Long sizeBytes,
        Integer attempts,
        Instant lastAttemptAt,
        Instant nextAttemptAt,
        Instant generatedAt,
        String failureReason) {
}
