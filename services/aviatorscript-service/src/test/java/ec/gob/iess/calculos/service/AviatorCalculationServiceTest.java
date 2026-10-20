package ec.gob.iess.calculos.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import ec.gob.iess.calculos.dto.CalculoRequest;
import ec.gob.iess.calculos.dto.CalculoResponse;
import ec.gob.iess.calculos.entity.FormulaEntity;
import ec.gob.iess.calculos.repository.EjecucionRepository;
import ec.gob.iess.calculos.repository.FormulaRepository;
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
}
