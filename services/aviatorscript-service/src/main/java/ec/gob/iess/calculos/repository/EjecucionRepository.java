package ec.gob.iess.calculos.repository;

import ec.gob.iess.calculos.entity.EjecucionEntity;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class EjecucionRepository {

    public void guardar(EjecucionEntity ejecucion) {
        ejecucion.persist();
        ejecucion.flush();
    }

    public EjecucionEntity buscarPorId(Long id) {
        return EjecucionEntity.findById(id);
    }
}
