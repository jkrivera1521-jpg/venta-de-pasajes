package ec.gob.iess.calculos.dto;

public record AviatorVisualizationDiagnostic(
        String severity,
        String message,
        Integer line,
        Integer column) {
}
