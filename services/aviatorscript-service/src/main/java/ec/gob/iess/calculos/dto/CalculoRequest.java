package ec.gob.iess.calculos.dto;

import java.util.Map;

public record CalculoRequest(
    String idSolicitud,
    String codigoFormula,
    Map<String, Object> parametros
) {
}
