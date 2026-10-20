package ec.gob.iess.calculos.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ec.gob.iess.calculos.dto.AviatorVisualizationNode;
import ec.gob.iess.calculos.dto.AviatorVisualizationResponse;
import org.junit.jupiter.api.Test;

class AviatorVisualizationServiceTest {

    private final AviatorVisualizationService service = new AviatorVisualizationService();

    @Test
    void representaDecisionesErroresRetornosYCiclosSinEjecutarLaFormula() {
        AviatorVisualizationResponse response = service.analyze("""
                let total = 0;
                if (salarioMensual <= 0) {
                  throw "El salario mensual debe ser mayor que cero";
                } else {
                  for item in horasExtras {
                    if (item.horas <= 0) { continue; }
                    total = total + item.horas;
                  }
                }
                return seq.map("total", total);
                """, true);

        assertTrue(response.valid(), () -> response.diagnostics().toString());
        assertTrue(response.nodes().stream().anyMatch(node -> "decision".equals(node.type())));
        assertTrue(response.nodes().stream().anyMatch(node -> "iteration".equals(node.type())));
        assertTrue(response.nodes().stream().anyMatch(node -> "exception".equals(node.type())));
        assertTrue(response.nodes().stream().anyMatch(node -> "return".equals(node.type())));
        assertTrue(response.edges().stream().anyMatch(edge -> "true".equals(edge.label())));
        assertTrue(response.edges().stream().anyMatch(edge -> "continuar".equals(edge.label())));
        assertTrue(response.nodes().stream().map(AviatorVisualizationNode::sourceCode).anyMatch(code -> code.contains("salarioMensual")));
    }

    @Test
    void devuelveDiagnosticoParaCodigoIncompleto() {
        AviatorVisualizationResponse response = service.analyze("if (salarioMensual <= 0) {", true);

        assertFalse(response.valid());
        assertFalse(response.diagnostics().isEmpty());
        assertTrue(response.diagnostics().get(0).message().contains("cerrar")
                || response.diagnostics().get(0).message().contains("bloque"));
    }

    @Test
    void noIncluyeCodigoFuenteCuandoSeSolicitaSoloElGrafo() {
        AviatorVisualizationResponse response = service.analyze("return salarioMensual;", false);

        assertTrue(response.valid());
        assertTrue(response.nodes().stream().allMatch(node -> node.sourceCode().isEmpty()));
    }
}
