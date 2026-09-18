package com.ventapasajes.reporting.api.dto;

import java.math.BigDecimal;

public record MoneyResponse(
        BigDecimal amount,
        String currency) {
}
