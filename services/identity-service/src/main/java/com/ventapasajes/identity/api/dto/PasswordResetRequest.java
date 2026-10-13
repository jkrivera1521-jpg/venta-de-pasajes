package com.ventapasajes.identity.api.dto;

public record PasswordResetRequest(String token, String newPassword) {
}
