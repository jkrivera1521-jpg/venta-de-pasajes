package com.ventapasajes.audit.api.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record AuditEventRequest(
        UUID eventId,
        String eventType,
        Integer schemaVersion,
        Instant occurredAt,
        String sourceService,
        UUID correlationId,
        UUID causationId,
        UUID actorUserId,
        String action,
        String resourceType,
        String resourceId,
        Map<String, Object> payload) {
}
