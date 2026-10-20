package ec.gob.iess.calculos.dto;

import java.time.OffsetDateTime;

public record FormulaTemplateResponse(
    String codigo,
    String nombre,
    String descripcion,
    Integer version,
    String expresion,
    Boolean activa,
    OffsetDateTime fechaCreacion
) {
}
