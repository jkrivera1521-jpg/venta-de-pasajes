package com.ventapasajes.identity.api.dto;

import java.util.List;
import java.util.UUID;

import com.ventapasajes.identity.domain.IdentityType;

public record UserCreateRequest(
        IdentityType identityType,
        String login,
        String email,
        String googleSubject,
        String displayName,
        String employeeCode,
        String firstName,
        String lastName,
        String phone,
        String address,
        String jobTitle,
        String temporaryPassword,
        List<UUID> roleIds) {
}
