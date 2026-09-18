package com.ventapasajes.audit.api.dto;

public record PageMetaResponse(
        int page,
        int pageSize,
        long totalItems,
        long totalPages) {
}
