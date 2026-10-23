package ec.gob.iess.calculos.dto;

import java.util.List;

public record AviatorValidationResponse(
    int contractVersion,
    String engine,
    boolean valid,
    List<AviatorDiagnostic> diagnostics
) {
}
