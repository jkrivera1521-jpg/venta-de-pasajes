package com.ventapasajes.reporting.api.dto;

import java.util.UUID;

public record SalesByUserRowResponse(
        UUID userId,
        String userDisplayName,
        long ticketsSold,
        MoneyResponse netAmount) {
}
