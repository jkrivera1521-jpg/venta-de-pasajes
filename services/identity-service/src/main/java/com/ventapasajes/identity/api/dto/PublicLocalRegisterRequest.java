package com.ventapasajes.identity.api.dto;

public record PublicLocalRegisterRequest(
        String login,
        String email,
        String displayName,
        String password) {
}
