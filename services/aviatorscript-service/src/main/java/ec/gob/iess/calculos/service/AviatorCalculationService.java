package ec.gob.iess.calculos.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.googlecode.aviator.AviatorEvaluator;
import com.googlecode.aviator.Expression;
import com.googlecode.aviator.exception.StandardError;
import ec.gob.iess.calculos.dto.CalculoRequest;
import ec.gob.iess.calculos.dto.CalculoResponse;
import ec.gob.iess.calculos.entity.EjecucionEntity;
import ec.gob.iess.calculos.entity.FormulaEntity;
import ec.gob.iess.calculos.repository.EjecucionRepository;
import ec.gob.iess.calculos.repository.FormulaRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@ApplicationScoped
public class AviatorCalculationService {

    @Inject FormulaRepository formulaRepository;
    @Inject EjecucionRepository ejecucionRepository;
    @Inject ObjectMapper objectMapper;

    private final ConcurrentMap<String, Expression> cache = new ConcurrentHashMap<>();

    @Transactional
    public CalculoResponse ejecutar(CalculoRequest request) {
        OffsetDateTime inicio = OffsetDateTime.now();
        long inicioNanos = System.nanoTime();
        EjecucionEntity registro = new EjecucionEntity();

        registro.idSolicitud = request != null && request.idSolicitud() != null
            ? request.idSolicitud() : "NO_ESPECIFICADA";
        registro.codigoFormula = request != null && request.codigoFormula() != null
            ? request.codigoFormula() : "NO_ESPECIFICADA";
        registro.parametros = request != null && request.parametros() != null
            ? request.parametros() : Map.of();
        registro.fechaInicio = inicio;

        try {
            validar(request);
            FormulaEntity formula = formulaRepository.buscarActiva(request.codigoFormula())
                .orElse(null);

            if (formula == null) {
                registro.estado = "FORMULA_NO_ENCONTRADA";
                registro.error = "No existe una fórmula activa con el código solicitado.";
                return guardarRespuesta(registro, inicioNanos);
            }

            registro.formulaId = formula.id;
            registro.versionFormula = formula.version;
            String clave = formula.codigo + ":" + formula.version;
            Expression expresion = cache.computeIfAbsent(
                clave, ignored -> AviatorEvaluator.compile(formula.expresion)
            );

            Object valor = expresion.execute(registro.parametros);
            JsonNode resultado = objectMapper.valueToTree(valor);
            registro.resultado = resultado;
            registro.tipoResultado = valor == null ? "null" : valor.getClass().getName();
            registro.estado = "EXITOSO";
            registro.error = null;
        } catch (IllegalArgumentException e) {
            registro.estado = "SOLICITUD_INVALIDA";
            registro.error = mensajeSeguro(e);
        } catch (Exception e) {
            if (e instanceof StandardError) {
                registro.estado = "SOLICITUD_INVALIDA";
                registro.error = mensajeSeguro(e);
            } else {
                registro.estado = "ERROR_CALCULO";
                registro.error = "No fue posible evaluar la fórmula. Revise los registros internos.";
            }
        }

        return guardarRespuesta(registro, inicioNanos);
    }

    private void validar(CalculoRequest request) {
        if (request == null) throw new IllegalArgumentException("La solicitud es obligatoria.");
        if (request.idSolicitud() == null || request.idSolicitud().isBlank())
            throw new IllegalArgumentException("El identificador de solicitud es obligatorio.");
        if (request.idSolicitud().length() > 100)
            throw new IllegalArgumentException("El identificador de solicitud supera 100 caracteres.");
        if (request.codigoFormula() == null || request.codigoFormula().isBlank())
            throw new IllegalArgumentException("El código de fórmula es obligatorio.");
        if (request.codigoFormula().length() > 100)
            throw new IllegalArgumentException("El código de fórmula supera 100 caracteres.");
        if (request.parametros() == null)
            throw new IllegalArgumentException("El mapa de parámetros es obligatorio.");
        if (request.parametros().size() > 200)
            throw new IllegalArgumentException("No se permiten más de 200 parámetros.");
    }

    private CalculoResponse guardarRespuesta(EjecucionEntity registro, long inicioNanos) {
        registro.fechaFin = OffsetDateTime.now();
        registro.duracionMs = (System.nanoTime() - inicioNanos) / 1_000_000;
        ejecucionRepository.guardar(registro);
        return new CalculoResponse(
            registro.id, registro.idSolicitud, registro.codigoFormula,
            registro.versionFormula, registro.parametros, registro.resultado,
            registro.tipoResultado, registro.estado, registro.fechaInicio,
            registro.fechaFin, registro.duracionMs, registro.error
        );
    }

    private String mensajeSeguro(Throwable e) {
        String mensaje = e.getMessage();
        return mensaje == null || mensaje.isBlank() ? "Solicitud inválida." : mensaje;
    }
}
