package com.ventapasajes.dispatch.service;

import java.util.UUID;

public record AuditContext(
        UUID actorUserId,
        UUID correlationId) {

    public static AuditContext anonymous() {
        return new AuditContext(null, UUID.randomUUID());
    }
}
