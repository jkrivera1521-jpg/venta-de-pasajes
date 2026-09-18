package com.ventapasajes.identity.api.dto;

import java.time.Instant;
import java.util.UUID;

public record AuthorizedIdentityResponse(
        UUID id,
        String type,
        String value,
        boolean active,
        UUID createdByUserId,
        Instant createdAt,
        Instant updatedAt) {
}
