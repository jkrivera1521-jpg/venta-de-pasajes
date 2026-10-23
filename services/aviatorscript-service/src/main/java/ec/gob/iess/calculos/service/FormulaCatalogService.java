package ec.gob.iess.calculos.service;

import com.fasterxml.jackson.databind.JsonNode;
import ec.gob.iess.calculos.dto.FormulaSaveRequest;
import ec.gob.iess.calculos.dto.FormulaTemplateResponse;
import ec.gob.iess.calculos.entity.FormulaEntity;
import ec.gob.iess.calculos.repository.FormulaRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.NoSuchElementException;

@ApplicationScoped
public class FormulaCatalogService {

    @Inject FormulaRepository formulaRepository;

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<FormulaTemplateResponse> listarPlantillas() {
        return formulaRepository.listarPlantillas().stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public FormulaTemplateResponse guardarNuevaVersion(FormulaSaveRequest request, String authenticatedActor) {
        if (request == null) {
            throw new IllegalArgumentException("El cuerpo de la formula es obligatorio.");
        }

        String codigo = requiredText(request.codigo(), "El codigo de la formula es obligatorio.");
        String nombre = requiredText(request.nombre(), "El nombre de la formula es obligatorio.");
        String expresion = requiredText(request.expresion(), "La expresion de la formula es obligatoria.");

        if (codigo.length() > 100) {
            throw new IllegalArgumentException("El codigo de la formula no puede superar 100 caracteres.");
        }
        if (!codigo.matches("[A-Za-z0-9][A-Za-z0-9._-]*")) {
            throw new IllegalArgumentException("El codigo solo puede contener letras, numeros, punto, guion y guion bajo.");
        }
        if (nombre.length() > 200) {
            throw new IllegalArgumentException("El nombre de la formula no puede superar 200 caracteres.");
        }
        if (expresion.length() > 100_000) {
            throw new IllegalArgumentException("La expresion de la formula supera el limite permitido.");
        }

        String descripcion = request.descripcion() == null ? null : request.descripcion().trim();
        if (descripcion != null && descripcion.length() > 2_000) {
            throw new IllegalArgumentException("La descripcion de la formula no puede superar 2000 caracteres.");
        }

        validarEjemplo(request.ejemplo());

        List<FormulaEntity> versiones = formulaRepository.buscarPorCodigo(codigo);
        int siguienteVersion = versiones.stream()
            .map(formula -> formula.version == null ? 0 : formula.version)
            .max(Integer::compareTo)
            .orElse(0) + 1;

        FormulaEntity formula = new FormulaEntity();
        formula.codigo = codigo;
        formula.nombre = nombre;
        formula.descripcion = descripcion;
        formula.version = siguienteVersion;
        formula.expresion = expresion;
        formula.ejemplo = request.ejemplo();
        formula.activa = false;
        formula.estado = "BORRADOR";
        formula.creadoPor = normalizeActor(authenticatedActor);
        formula.fechaCreacion = OffsetDateTime.now(ZoneOffset.UTC);

        return toResponse(formulaRepository.guardar(formula));
    }

    @Transactional
    public FormulaTemplateResponse publicar(Long id, String authenticatedActor) {
        FormulaEntity formula = findRequired(id);
        formula.estado = "PUBLICADA";
        formula.publicadoPor = normalizeActor(authenticatedActor);
        formula.fechaPublicacion = OffsetDateTime.now(ZoneOffset.UTC);
        return toResponse(formulaRepository.actualizar(formula));
    }

    @Transactional
    public FormulaTemplateResponse activar(Long id, String authenticatedActor) {
        FormulaEntity formula = findRequired(id);
        if (!"PUBLICADA".equals(formula.estado)) {
            throw new IllegalArgumentException("La formula debe publicarse antes de activarse.");
        }

        formulaRepository.desactivarActivas(formula.codigo);
        formula.activa = true;
        formula.activadoPor = normalizeActor(authenticatedActor);
        formula.fechaActivacion = OffsetDateTime.now(ZoneOffset.UTC);
        return toResponse(formulaRepository.actualizar(formula));
    }

    private FormulaTemplateResponse toResponse(FormulaEntity formula) {
        return new FormulaTemplateResponse(
            formula.id,
            formula.codigo,
            formula.nombre,
            formula.descripcion,
            formula.version,
            formula.expresion,
            formula.ejemplo,
            formula.activa,
            formula.fechaCreacion,
            formula.estado,
            formula.creadoPor,
            formula.publicadoPor,
            formula.fechaPublicacion,
            formula.activadoPor,
            formula.fechaActivacion
        );
    }

    private FormulaEntity findRequired(Long id) {
        return formulaRepository.buscarPorId(id)
            .orElseThrow(() -> new NoSuchElementException("No existe la formula solicitada."));
    }

    private static String normalizeActor(String actor) {
        String normalized = actor == null ? "" : actor.trim();
        return normalized.isEmpty() ? "desconocido" : normalized.substring(0, Math.min(normalized.length(), 200));
    }

    private static String requiredText(String value, String message) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private static void validarEjemplo(JsonNode ejemplo) {
        if (ejemplo == null || !ejemplo.isObject()) {
            throw new IllegalArgumentException("El ejemplo de prueba debe ser un objeto JSON.");
        }
        if (ejemplo.toString().length() > 100_000) {
            throw new IllegalArgumentException("El ejemplo de prueba supera el limite permitido.");
        }
        validarProfundidad(ejemplo, 0);
    }

    private static void validarProfundidad(JsonNode node, int depth) {
        if (depth > 20) {
            throw new IllegalArgumentException("El ejemplo de prueba supera la profundidad permitida.");
        }
        node.elements().forEachRemaining(child -> validarProfundidad(child, depth + 1));
    }
}
