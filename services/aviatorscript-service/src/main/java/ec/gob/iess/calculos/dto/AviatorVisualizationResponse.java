package ec.gob.iess.calculos.dto;

import java.util.List;

public record AviatorVisualizationResponse(
        boolean valid,
        List<AviatorVisualizationNode> nodes,
        List<AviatorVisualizationEdge> edges,
        List<AviatorVisualizationDiagnostic> diagnostics) {
}
