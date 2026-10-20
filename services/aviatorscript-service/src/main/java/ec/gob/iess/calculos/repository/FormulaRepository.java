package ec.gob.iess.calculos.repository;

import ec.gob.iess.calculos.entity.FormulaEntity;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class FormulaRepository {

    public List<FormulaEntity> listarPlantillas() {
        return FormulaEntity.find("order by codigo asc, version desc").list();
    }

    public Optional<FormulaEntity> buscarActiva(String codigo) {
        return FormulaEntity.find(
            "codigo = ?1 and activa = true order by version desc", codigo
        ).firstResultOptional();
    }
}
