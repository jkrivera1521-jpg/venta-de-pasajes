package ec.gob.iess.calculos;

import static org.mockito.Mockito.when;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import java.util.Map;
import java.util.Optional;

import ec.gob.iess.calculos.entity.FormulaEntity;
import ec.gob.iess.calculos.repository.EjecucionRepository;
import ec.gob.iess.calculos.repository.FormulaRepository;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class CalculoResourceTest {

    @InjectMock
    FormulaRepository formulaRepository;

    @InjectMock
    EjecucionRepository ejecucionRepository;

    @BeforeEach
    void configurarFormulaActiva() {
        FormulaEntity formula = new FormulaEntity();
        formula.id = 1L;
        formula.codigo = "FORM-NOMINA-001";
        formula.version = 1;
        formula.expresion = "salario + bonificacion - descuento";
        formula.activa = true;

        when(formulaRepository.buscarActiva("FORM-NOMINA-001"))
                .thenReturn(Optional.of(formula));
    }

    @Test
    void ejecutaFormulaDeNomina() {
        given()
            .contentType("application/json")
            .body("""
                {
                  "idSolicitud":"TEST-0001",
                  "codigoFormula":"FORM-NOMINA-001",
                  "parametros":{"salario":1200,"bonificacion":150,"descuento":50}
                }
                """)
        .when()
            .post("/api/v1/calculos/ejecutar")
        .then()
            .statusCode(200)
            .body("estado", equalTo("EXITOSO"))
            .body("codigoFormula", equalTo("FORM-NOMINA-001"))
            .body("resultado", equalTo(1300));
    }

    @Test
    void rechazaSolicitudSinParametros() {
        given()
            .contentType("application/json")
            .body(Map.of(
                "idSolicitud", "TEST-0002",
                "codigoFormula", "FORM-NOMINA-001"))
        .when()
            .post("/api/v1/calculos/ejecutar")
        .then()
            .statusCode(400)
            .body("estado", equalTo("SOLICITUD_INVALIDA"));
    }
}
