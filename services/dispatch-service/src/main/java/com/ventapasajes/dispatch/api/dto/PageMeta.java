package com.ventapasajes.dispatch.api.dto;

public record PageMeta(
        int page,
        int pageSize,
        long totalItems,
        int totalPages) {
}
