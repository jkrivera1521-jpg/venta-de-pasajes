package com.ventapasajes.document.api.dto;

public record DocumentOverviewResponse(
        String service,
        String basePath,
        String storageProvider,
        String defaultTemplate,
        String status) {
}
