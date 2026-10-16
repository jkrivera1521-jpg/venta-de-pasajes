package ec.gob.iess.calculos.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.Map;

public record CalculoResponse(
    Long idEjecucion,
    String idSolicitud,
    String codigoFormula,
    Integer versionFormula,
    Map<String, Object> parametros,
    JsonNode resultado,
    String tipoResultado,
    String estado,
    OffsetDateTime fechaInicio,
    OffsetDateTime fechaFin,
    Long duracionMs,
    String error
) {
}
