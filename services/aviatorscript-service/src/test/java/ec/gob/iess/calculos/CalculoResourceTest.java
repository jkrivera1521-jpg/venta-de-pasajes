package ec.gob.iess.calculos;

import static org.mockito.Mockito.when;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.doAnswer;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.util.Map;
import java.util.List;
import java.util.Optional;

import ec.gob.iess.calculos.entity.FormulaEntity;
import ec.gob.iess.calculos.repository.EjecucionRepository;
import ec.gob.iess.calculos.repository.FormulaRepository;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.specification.RequestSpecification;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class CalculoResourceTest {

    private static final String[] ALL_PERMISSIONS = {
        "aviatorscript.formulas.read",
        "aviatorscript.formulas.write",
        "aviatorscript.formulas.validate",
        "aviatorscript.formulas.test",
        "aviatorscript.formulas.execute",
        "aviatorscript.formulas.publish",
        "aviatorscript.formulas.activate",
        "aviatorscript.formulas.visualize"
    };

    private static RequestSpecification authenticated() {
        return authenticatedWith(ALL_PERMISSIONS);
    }

    private static RequestSpecification authenticatedWith(String... permissions) {
        return given().header("Authorization", "Bearer " + TestJwtToken.issue("prueba.aviator", permissions));
    }

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
        formula.ejemplo = JsonNodeFactory.instance.objectNode()
                .put("codigoFormula", "FORM-NOMINA-001");
        formula.activa = true;

        when(formulaRepository.buscarActiva("FORM-NOMINA-001"))
                .thenReturn(Optional.of(formula));
    }

    @Test
    void ejecutaFormulaDeNomina() {
        authenticated()
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
    void rechazaLaConsultaSinToken() {
        given()
        .when()
            .get("/api/v1/calculos/formulas")
        .then()
            .statusCode(401)
            .body("error.code", equalTo("UNAUTHORIZED"));
    }

    @Test
    void rechazaLaOperacionSinElPermisoCorrespondiente() {
        authenticatedWith("aviatorscript.formulas.read")
        .when()
            .post("/api/v1/calculos/validar")
        .then()
            .statusCode(403)
            .body("error.code", equalTo("FORBIDDEN"));
    }

    @Test
    void validaYPruebaFuenteConElMotorCanonico() {
        authenticated()
            .contentType("application/json")
            .body("{\"source\":\"return salario + bonificacion;\"}")
        .when()
            .post("/api/v1/calculos/validar")
        .then()
            .statusCode(200)
            .body("valid", equalTo(true))
            .body("engine", equalTo("aviator-5.8.0"))
            .body("contractVersion", equalTo(1));

        authenticated()
            .contentType("application/json")
            .body("{\"source\":\"return salario + bonificacion;\",\"parametros\":{\"salario\":1200,\"bonificacion\":150}}")
        .when()
            .post("/api/v1/calculos/probar")
        .then()
            .statusCode(200)
            .body("success", equalTo(true))
            .body("result", equalTo(1350));
    }

    @Test
    void listaFormulasComoPlantillasDeSoloLectura() {
        FormulaEntity formula = new FormulaEntity();
        formula.id = 1L;
        formula.codigo = "FORM-NOMINA-001";
        formula.nombre = "Calculo de salario neto";
        formula.descripcion = "Calcula el salario neto restando descuentos y sumando bonificaciones.";
        formula.version = 1;
        formula.expresion = "salario + bonificacion - descuento";
        formula.activa = true;
        FormulaEntity formulaAnterior = new FormulaEntity();
        formulaAnterior.id = 2L;
        formulaAnterior.codigo = formula.codigo;
        formulaAnterior.nombre = formula.nombre;
        formulaAnterior.version = 0;
        formulaAnterior.expresion = "salario - descuento";
        formulaAnterior.activa = false;
        when(formulaRepository.listarPlantillas()).thenReturn(List.of(formula, formulaAnterior));

        authenticated()
        .when()
            .get("/api/v1/calculos/formulas")
        .then()
            .statusCode(200)
            .body("size()", equalTo(2))
            .body("[0].id", equalTo(1))
            .body("[0].codigo", equalTo("FORM-NOMINA-001"))
            .body("[0].descripcion", equalTo("Calcula el salario neto restando descuentos y sumando bonificaciones."))
            .body("[0].version", equalTo(1))
            .body("[0].expresion", equalTo("salario + bonificacion - descuento"))
            .body("[0].ejemplo.codigoFormula", equalTo("FORM-NOMINA-001"))
            .body("[1].version", equalTo(0))
            .body("[1].descripcion", nullValue())
            .body("[1].activa", equalTo(false));
    }

    @Test
    void guardaUnaNuevaVersionEnLaBaseDeDatos() {
        FormulaEntity anterior = new FormulaEntity();
        anterior.id = 8L;
        anterior.codigo = "FORM-NOMINA-001";
        anterior.version = 3;
        anterior.expresion = "salario - descuento";
        anterior.activa = true;
        when(formulaRepository.buscarPorCodigo("FORM-NOMINA-001")).thenReturn(List.of(anterior));
        doAnswer(invocation -> {
            FormulaEntity saved = invocation.getArgument(0);
            saved.id = 9L;
            return saved;
        }).when(formulaRepository).guardar(any(FormulaEntity.class));

        authenticated()
            .contentType("application/json")
            .body("""
                {
                  "codigo":"FORM-NOMINA-001",
                  "nombre":"Calculo de salario neto",
                  "descripcion":"Nueva version persistida desde el constructor.",
                  "expresion":"salario + bonificacion - descuento",
                  "ejemplo":{"idSolicitud":"TEST-DB-0001","codigoFormula":"FORM-NOMINA-001","parametros":{"salario":1200,"bonificacion":150,"descuento":50}}
                }
                """)
        .when()
            .post("/api/v1/calculos/formulas")
        .then()
            .statusCode(201)
            .body("id", equalTo(9))
            .body("codigo", equalTo("FORM-NOMINA-001"))
            .body("version", equalTo(4))
            .body("activa", equalTo(false))
            .body("estado", equalTo("BORRADOR"))
            .body("creadoPor", equalTo("prueba.aviator"))
            .body("ejemplo.idSolicitud", equalTo("TEST-DB-0001"));
    }

    @Test
    void publicaYActivaUnaVersionEnDosPasos() {
        FormulaEntity formula = new FormulaEntity();
        formula.id = 12L;
        formula.codigo = "FORM-TEST-001";
        formula.nombre = "Formula de prueba";
        formula.version = 1;
        formula.expresion = "salario";
        formula.ejemplo = JsonNodeFactory.instance.objectNode();
        formula.estado = "BORRADOR";
        formula.creadoPor = "usuario.prueba";
        formula.activa = false;
        when(formulaRepository.buscarPorId(12L)).thenReturn(Optional.of(formula));
        doAnswer(invocation -> invocation.getArgument(0)).when(formulaRepository).actualizar(any(FormulaEntity.class));

        authenticated()
            .contentType("application/json")
            .body("{\"actor\":\"publicador.prueba\"}")
        .when()
            .post("/api/v1/calculos/formulas/12/publicar")
        .then()
            .statusCode(200)
            .body("estado", equalTo("PUBLICADA"))
            .body("publicadoPor", equalTo("prueba.aviator"));

        authenticated()
            .contentType("application/json")
            .body("{\"actor\":\"activador.prueba\"}")
        .when()
            .post("/api/v1/calculos/formulas/12/activar")
        .then()
            .statusCode(200)
            .body("activa", equalTo(true))
            .body("activadoPor", equalTo("prueba.aviator"));
    }

    @Test
    void rechazaGuardarFormulaConCodigoInvalido() {
        authenticated()
            .contentType("application/json")
            .body("""
                {
                  "codigo":"FORMULA NOMINA",
                  "nombre":"Formula invalida",
                  "expresion":"salario",
                  "ejemplo":{}
                }
                """)
        .when()
            .post("/api/v1/calculos/formulas")
        .then()
            .statusCode(400)
            .body("error", equalTo("El codigo solo puede contener letras, numeros, punto, guion y guion bajo."));
    }

    @Test
    void rechazaSolicitudSinParametros() {
        authenticated()
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

        authenticated()
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
