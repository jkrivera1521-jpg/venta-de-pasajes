package ec.gob.iess.calculos.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record FormulaSaveRequest(
    String codigo,
    String nombre,
    String descripcion,
    String expresion,
    JsonNode ejemplo,
    JsonNode contratoEntrada,
    JsonNode contratoSalida,
    JsonNode configuracionInterfaz,
    String creadoPor
) {
}
