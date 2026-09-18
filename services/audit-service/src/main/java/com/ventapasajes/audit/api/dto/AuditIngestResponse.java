package com.ventapasajes.audit.api.dto;

import java.util.UUID;

public record AuditIngestResponse(
        UUID eventId,
        String status,
        boolean processed,
        AuditEventResponse event) {
}
