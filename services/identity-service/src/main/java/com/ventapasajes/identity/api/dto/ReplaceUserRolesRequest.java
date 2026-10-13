package com.ventapasajes.identity.api.dto;

import java.util.List;
import java.util.UUID;

public record ReplaceUserRolesRequest(List<UUID> roleIds) {
}
