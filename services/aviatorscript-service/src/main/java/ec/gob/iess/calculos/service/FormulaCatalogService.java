package ec.gob.iess.calculos.service;

import ec.gob.iess.calculos.dto.FormulaTemplateResponse;
import ec.gob.iess.calculos.repository.FormulaRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.List;

@ApplicationScoped
public class FormulaCatalogService {

    @Inject FormulaRepository formulaRepository;

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<FormulaTemplateResponse> listarPlantillas() {
        return formulaRepository.listarPlantillas().stream()
            .map(formula -> new FormulaTemplateResponse(
                formula.codigo,
                formula.nombre,
                formula.descripcion,
                formula.version,
                formula.expresion,
                formula.activa,
                formula.fechaCreacion
            ))
            .toList();
    }
}
