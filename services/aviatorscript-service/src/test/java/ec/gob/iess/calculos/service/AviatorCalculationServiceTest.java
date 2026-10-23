package ec.gob.iess.calculos.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import ec.gob.iess.calculos.dto.CalculoRequest;
import ec.gob.iess.calculos.dto.CalculoResponse;
import ec.gob.iess.calculos.entity.FormulaEntity;
import ec.gob.iess.calculos.repository.EjecucionRepository;
import ec.gob.iess.calculos.repository.FormulaRepository;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AviatorCalculationServiceTest {

    @Test
    void devuelveElMensajeLanzadoPorLaFormulaComoSolicitudInvalida() {
        String codigoFormula = "FORM-TEST-THROW-001";
        String mensaje = "El salario mensual debe ser mayor que cero";
        FormulaEntity formula = new FormulaEntity();
        formula.id = 1L;
        formula.codigo = codigoFormula;
        formula.version = 1;
        formula.expresion = "if (salarioMensual <= 0) { throw \"" + mensaje + "\"; } return salarioMensual;";

        AviatorCalculationService service = new AviatorCalculationService();
        service.formulaRepository = new FormulaRepository() {
            @Override
            public Optional<FormulaEntity> buscarActiva(String codigo) {
                return codigoFormula.equals(codigo) ? Optional.of(formula) : Optional.empty();
            }
        };
        service.ejecucionRepository = new EjecucionRepository() {
            @Override
            public void guardar(ec.gob.iess.calculos.entity.EjecucionEntity ejecucion) {
            }
        };
        service.objectMapper = new ObjectMapper();

        CalculoResponse response = service.ejecutar(new CalculoRequest(
            "TEST-VALIDACION-0001", codigoFormula, Map.of("salarioMensual", -1)
        ));

        assertEquals("SOLICITUD_INVALIDA", response.estado());
        assertEquals(mensaje, response.error());
    }

    @Test
    void evaluaElEjemploDocumentadoDeComisionEjecutiva() {
        String expresion = """
            let ventasValidas = seq.filter(ventasDirectas, lambda(v) -> v.moraCobro == false end);
            let totalVendidoDirecto = seq.reduce(ventasValidas, lambda(acc, v) -> acc + v.monto end, 0.0);
            let totalSoftware = seq.reduce(
                seq.filter(ventasValidas, lambda(v) -> v.categoria == \"SOFTWARE\" end),
                lambda(acc, v) -> acc + v.monto end, 0.0
            );
            let tasaCumplimiento = totalVendidoDirecto / ejecutivo.metaCuotaGlobal;
            let comisionBaseDirecta = 0.0;
            let montoRestante = totalVendidoDirecto;
            let tramo1Cap = ejecutivo.metaCuotaGlobal * 0.80;
            if (montoRestante > 0) {
                let montoTramo1 = math.min(montoRestante, tramo1Cap);
                comisionBaseDirecta = comisionBaseDirecta + (montoTramo1 * 0.03);
                montoRestante = montoRestante - montoTramo1;
            }
            let tramo2Cap = ejecutivo.metaCuotaGlobal * 0.20;
            if (montoRestante > 0) {
                let montoTramo2 = math.min(montoRestante, tramo2Cap);
                comisionBaseDirecta = comisionBaseDirecta + (montoTramo2 * 0.06);
                montoRestante = montoRestante - montoTramo2;
            }
            if (montoRestante > 0) {
                comisionBaseDirecta = comisionBaseDirecta + (montoRestante * 0.10);
            }
            let totalClawback = seq.reduce(clawbacks, lambda(acc, c) -> acc + c.montoComisionAbonadaPreviamente end, 0.0);
            let liquidacionNeto = comisionBaseDirecta - totalClawback;
            return seq.map(
                \"ejecutivoId\", ejecutivo.id,
                \"totalVendidoDirecto\", totalVendidoDirecto,
                \"tasaCumplimiento\", tasaCumplimiento,
                \"comisionBaseDirecta\", comisionBaseDirecta,
                \"clawbacks\", totalClawback,
                \"netoAPagar\", liquidacionNeto
            );
            """;

        Map<String, Object> parametros = new LinkedHashMap<>(Map.of(
            "ventasDirectas", List.of(
                Map.of("monto", 45000, "idVenta", "V-101", "categoria", "SOFTWARE", "moraCobro", false),
                Map.of("monto", 25000, "idVenta", "V-102", "categoria", "SERVICIOS", "moraCobro", false),
                Map.of("monto", 30000, "idVenta", "V-103", "categoria", "SOFTWARE", "moraCobro", false),
                Map.of("monto", 18000, "idVenta", "V-104", "categoria", "SOFTWARE", "moraCobro", true)
            ),
            "ejecutivo", Map.of("id", "EXEC-0092", "rol", "DIRECTOR_COMERCIAL", "metaCuotaGlobal", 100000, "porcentajeComisionEquipo", 0.025),
            "clawbacks", List.of(Map.of("motivo", "CANCELACION_CONTRATO", "idVentaRevertida", "V-089", "montoComisionAbonadaPreviamente", 1200))
        ));

        String codigoFormula = "FORM-COMISION-EJECUTIVA-V1";
        FormulaEntity formula = new FormulaEntity();
        formula.id = 1L;
        formula.codigo = codigoFormula;
        formula.version = 1;
        formula.expresion = expresion;

        AviatorCalculationService service = new AviatorCalculationService();
        service.formulaRepository = new FormulaRepository() {
            @Override
            public Optional<FormulaEntity> buscarActiva(String codigo) {
                return codigoFormula.equals(codigo) ? Optional.of(formula) : Optional.empty();
            }
        };
        service.ejecucionRepository = new EjecucionRepository() {
            @Override
            public void guardar(ec.gob.iess.calculos.entity.EjecucionEntity ejecucion) {
            }
        };
        service.objectMapper = new ObjectMapper();

        CalculoResponse response = service.ejecutar(new CalculoRequest(
            "COMISION-2026-0001", codigoFormula, parametros
        ));

        assertEquals("EXITOSO", response.estado(), response.error());
        assertNotNull(response.resultado());
        assertEquals("EXEC-0092", response.resultado().get("ejecutivoId").asText());
        assertEquals(100000.0, response.resultado().get("totalVendidoDirecto").asDouble());
    }
}
