package com.ventapasajes.identity.api.dto;

public record UserUpdateRequest(
        String displayName,
        String employeeCode,
        String firstName,
        String lastName,
        String phone,
        String address,
        String jobTitle) {
}
