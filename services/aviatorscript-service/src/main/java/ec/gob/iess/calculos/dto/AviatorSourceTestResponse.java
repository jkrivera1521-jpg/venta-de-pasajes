package ec.gob.iess.calculos.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record AviatorSourceTestResponse(
    int contractVersion,
    String engine,
    boolean success,
    JsonNode result,
    long executionTimeMs,
    String error
) {
}
