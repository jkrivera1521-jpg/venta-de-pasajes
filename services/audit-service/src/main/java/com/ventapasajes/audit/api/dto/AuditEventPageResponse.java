package com.ventapasajes.audit.api.dto;

import java.util.List;

public record AuditEventPageResponse(
        List<AuditEventResponse> data,
        PageMetaResponse meta) {
}
