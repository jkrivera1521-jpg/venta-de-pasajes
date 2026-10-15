package com.ventapasajes.identity.api.dto;

import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;

public record MenuItemRequest(
        String code,
        String label,
        String icon,
        @JsonProperty("target_url") String targetUrl,
        @JsonProperty("manifest_url") String manifestUrl,
        @JsonProperty("informational_only") Boolean informationalOnly,
        @JsonProperty("parent_id") UUID parentId,
        @JsonProperty("sort_order") Integer sortOrder,
        Boolean active,
        @JsonProperty("role_ids") List<UUID> roleIds) {
}
