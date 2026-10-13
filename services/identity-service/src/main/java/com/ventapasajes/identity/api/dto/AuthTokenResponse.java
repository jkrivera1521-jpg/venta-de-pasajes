package com.ventapasajes.identity.api.dto;

public record AuthTokenResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        CurrentUserResponse user) {
}
