package com.ventapasajes.identity.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ThemePreferenceRequest(
        @JsonProperty("dark_mode") boolean darkMode) {
}
