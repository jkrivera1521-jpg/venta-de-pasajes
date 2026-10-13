package com.ventapasajes.reporting.api.dto;

public record SalesGroupRowResponse(
        String groupKey,
        String groupLabel,
        long ticketsSold,
        MoneyResponse netAmount) {
}
