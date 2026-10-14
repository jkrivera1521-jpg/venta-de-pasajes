package com.ventapasajes.identity.api.dto;

import java.time.Instant;
import java.util.UUID;

public record IdentitySessionResponse(
        UUID id,
        UUID userId,
        String login,
        String email,
        String displayName,
        String identityType,
        String userStatus,
        Instant createdAt,
        Instant lastSeenAt,
        Instant expiresAt,
        String userAgent,
        String deviceName,
        String deviceType,
        String operatingSystem,
        String browser,
        String browserVersion,
        String location,
        String ipAddress,
        boolean current) {
}
