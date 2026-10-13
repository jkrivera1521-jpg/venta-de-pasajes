package com.ventapasajes.document.api.dto;

import java.util.UUID;

public record GenerateTicketDocumentRequest(
        String templateCode,
        UUID requestedByUserId,
        UUID correlationId,
        TicketDocumentData ticket) {
}
