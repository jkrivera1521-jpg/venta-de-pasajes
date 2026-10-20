package ec.gob.iess.calculos.dto;

import java.util.List;

public record AviatorVisualizationNode(
        String id,
        String type,
        String label,
        String instruction,
        String sourceCode,
        AviatorSourceRange source,
        List<String> referencedVariables,
        List<String> assignedVariables,
        List<AviatorVisualizationBranch> branches,
        List<String> previousIds,
        List<String> nextIds,
        boolean synthetic) {
}
