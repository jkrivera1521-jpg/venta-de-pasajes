package com.ventapasajes.identity.api.dto;

public record PasswordForgotResponse(boolean accepted, String recoveryToken) {
}
