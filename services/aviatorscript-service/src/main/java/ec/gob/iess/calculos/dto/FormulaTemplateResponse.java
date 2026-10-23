package ec.gob.iess.calculos.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;

public record FormulaTemplateResponse(
    Long id,
    String codigo,
    String nombre,
    String descripcion,
    Integer version,
    String expresion,
    JsonNode ejemplo,
    Boolean activa,
    OffsetDateTime fechaCreacion,
    String estado,
    String creadoPor,
    String publicadoPor,
    OffsetDateTime fechaPublicacion,
    String activadoPor,
    OffsetDateTime fechaActivacion
) {
}
