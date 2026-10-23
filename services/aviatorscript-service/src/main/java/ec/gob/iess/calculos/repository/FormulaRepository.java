package ec.gob.iess.calculos.repository;

import ec.gob.iess.calculos.entity.FormulaEntity;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class FormulaRepository {

    public List<FormulaEntity> listarPlantillas() {
        return FormulaEntity.find("order by id asc").list();
    }

    public Optional<FormulaEntity> buscarActiva(String codigo) {
        return FormulaEntity.find(
            "codigo = ?1 and activa = true order by version desc", codigo
        ).firstResultOptional();
    }

    public List<FormulaEntity> buscarPorCodigo(String codigo) {
        return FormulaEntity.find("codigo = ?1 order by version desc", codigo).list();
    }

    public Optional<FormulaEntity> buscarPorId(Long id) {
        return FormulaEntity.findByIdOptional(id);
    }

    public void desactivarActivas(String codigo) {
        FormulaEntity.update("activa = false where codigo = ?1 and activa = true", codigo);
    }

    public FormulaEntity guardar(FormulaEntity formula) {
        formula.persistAndFlush();
        return formula;
    }

    public FormulaEntity actualizar(FormulaEntity formula) {
        formula.persistAndFlush();
        return formula;
    }
}
