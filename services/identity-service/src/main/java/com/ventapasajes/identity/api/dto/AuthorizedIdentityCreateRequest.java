package com.ventapasajes.identity.api.dto;

import com.ventapasajes.identity.domain.AuthorizedIdentityType;

public record AuthorizedIdentityCreateRequest(
        AuthorizedIdentityType type,
        String value,
        Boolean active) {
}
