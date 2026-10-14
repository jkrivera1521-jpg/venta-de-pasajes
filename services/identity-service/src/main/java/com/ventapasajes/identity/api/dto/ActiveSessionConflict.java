package com.ventapasajes.identity.api.dto;

import java.util.List;

public record ActiveSessionConflict(List<IdentitySessionResponse> sessions) {
}
