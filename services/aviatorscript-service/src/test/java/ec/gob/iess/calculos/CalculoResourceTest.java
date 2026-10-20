package ec.gob.iess.calculos;

import static org.mockito.Mockito.when;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

import java.util.Map;
import java.util.List;
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
    void listaFormulasComoPlantillasDeSoloLectura() {
        FormulaEntity formula = new FormulaEntity();
        formula.codigo = "FORM-NOMINA-001";
        formula.nombre = "Calculo de salario neto";
        formula.descripcion = "Calcula el salario neto restando descuentos y sumando bonificaciones.";
        formula.version = 1;
        formula.expresion = "salario + bonificacion - descuento";
        formula.activa = true;
        FormulaEntity formulaAnterior = new FormulaEntity();
        formulaAnterior.codigo = formula.codigo;
        formulaAnterior.nombre = formula.nombre;
        formulaAnterior.version = 0;
        formulaAnterior.expresion = "salario - descuento";
        formulaAnterior.activa = false;
        when(formulaRepository.listarPlantillas()).thenReturn(List.of(formula, formulaAnterior));

        given()
        .when()
            .get("/api/v1/calculos/formulas")
        .then()
            .statusCode(200)
            .body("size()", equalTo(2))
            .body("[0].codigo", equalTo("FORM-NOMINA-001"))
            .body("[0].descripcion", equalTo("Calcula el salario neto restando descuentos y sumando bonificaciones."))
            .body("[0].version", equalTo(1))
            .body("[0].expresion", equalTo("salario + bonificacion - descuento"))
            .body("[1].version", equalTo(0))
            .body("[1].descripcion", nullValue())
            .body("[1].activa", equalTo(false));
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

    @Test
    void devuelveElMensajeDeValidacionLanzadoPorLaFormula() {
        String mensaje = "El salario mensual debe ser mayor que cero";
        FormulaEntity formula = new FormulaEntity();
        formula.id = 2L;
        formula.codigo = "FORM-TEST-VALIDACION-001";
        formula.version = 1;
        formula.expresion = "if (salarioMensual <= 0) { throw \"" + mensaje + "\"; } return salarioMensual;";
        formula.activa = true;
        when(formulaRepository.buscarActiva(formula.codigo)).thenReturn(Optional.of(formula));

        given()
            .contentType("application/json")
            .body("""
                {
                  "idSolicitud":"TEST-VALIDACION-0001",
                  "codigoFormula":"FORM-TEST-VALIDACION-001",
                  "parametros":{"salarioMensual":-1}
                }
                """)
        .when()
            .post("/api/v1/calculos/ejecutar")
        .then()
            .statusCode(400)
            .body("estado", equalTo("SOLICITUD_INVALIDA"))
            .body("error", equalTo(mensaje));
    }
}
