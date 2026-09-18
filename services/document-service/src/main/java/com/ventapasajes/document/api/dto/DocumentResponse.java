package com.ventapasajes.document.api.dto;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.document.domain.DocumentStatus;

public record DocumentResponse(
        UUID documentId,
        String ownerType,
        UUID ownerId,
        String type,
        DocumentStatus status,
        String templateCode,
        String storageProvider,
        String storageUri,
        String downloadUrl,
        String contentType,
        String fileName,
        String checksumSha256,
        Long sizeBytes,
        String ticketNumber,
        String passengerName,
        String routeName,
        Instant createdAt,
        Instant generatedAt,
        String failureReason,
        UUID eventId) {
}
