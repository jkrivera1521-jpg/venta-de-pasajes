package com.ventapasajes.identity.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record UserResponse(
        UUID id,
        Integer legacyId,
        String identityType,
        String login,
        String email,
        String googleSubject,
        String displayName,
        String status,
        String employeeCode,
        String firstName,
        String lastName,
        String phone,
        String address,
        String jobTitle,
        List<String> roles,
        Instant lastLoginAt,
        Instant lockedUntil,
        Instant createdAt,
        Instant updatedAt) {
}
