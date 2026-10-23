package ec.gob.iess.calculos.dto;

public record AviatorDiagnostic(
    String code,
    String message,
    Integer line,
    Integer column,
    String severity
) {
}
