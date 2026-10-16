package ec.gob.iess.calculos.repository;

import ec.gob.iess.calculos.entity.FormulaEntity;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

@ApplicationScoped
public class FormulaRepository {

    public Optional<FormulaEntity> buscarActiva(String codigo) {
        return FormulaEntity.find(
            "codigo = ?1 and activa = true order by version desc", codigo
        ).firstResultOptional();
    }
}
