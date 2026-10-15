package com.ventapasajes.identity.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ProfilePhotoRequest(
        @JsonProperty("avatar_url") String avatarUrl) {
}
