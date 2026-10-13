package com.ventapasajes.identity.api.dto;

import java.util.List;
import java.util.UUID;

public record UserCreateRequest(
        String login,
        String email,
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
