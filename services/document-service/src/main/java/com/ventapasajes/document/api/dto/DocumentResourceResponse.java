package com.ventapasajes.document.api.dto;

public record DocumentResourceResponse(
        String name,
        String description,
        String owner,
        String path) {
}
