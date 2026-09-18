package com.ventapasajes.audit.api.dto;

import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

public record AuditEventResponse(
        UUID eventId,
        String eventType,
        int schemaVersion,
        Instant occurredAt,
        Instant ingestedAt,
        String sourceService,
        UUID correlationId,
        UUID causationId,
        UUID actorUserId,
        String action,
        String resourceType,
        String resourceId,
        String idempotencyKey,
        JsonNode payload,
        JsonNode rawEvent) {
}
