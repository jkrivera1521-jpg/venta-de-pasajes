package ec.gob.iess.calculos.api;

import ec.gob.iess.calculos.dto.CalculoRequest;
import ec.gob.iess.calculos.dto.CalculoResponse;
import ec.gob.iess.calculos.dto.FormulaLifecycleRequest;
import ec.gob.iess.calculos.dto.FormulaSaveRequest;
import ec.gob.iess.calculos.dto.FormulaTemplateResponse;
import ec.gob.iess.calculos.auth.RequestIdentity;
import ec.gob.iess.calculos.service.AviatorCalculationService;
import ec.gob.iess.calculos.service.FormulaCatalogService;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@Path("/api/v1/calculos")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class CalculoResource {

    @Inject AviatorCalculationService servicio;
    @Inject FormulaCatalogService catalogoFormulas;
    @Inject RequestIdentity requestIdentity;

    @GET
    @Path("/formulas")
    public List<FormulaTemplateResponse> listarFormulas() {
        return catalogoFormulas.listarPlantillas();
    }

    @POST
    @Path("/formulas")
    public Response guardarFormula(FormulaSaveRequest request) {
        try {
            FormulaTemplateResponse saved = catalogoFormulas.guardarNuevaVersion(request, requestIdentity.requireUser().actor());
            return Response.status(Response.Status.CREATED).entity(saved).build();
        } catch (IllegalArgumentException error) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(Map.of("error", error.getMessage()))
                .build();
        }
    }

    @POST
    @Path("/formulas/{id}/publicar")
    public Response publicarFormula(@PathParam("id") Long id, FormulaLifecycleRequest request) {
        return ejecutarCambioEstado(() -> catalogoFormulas.publicar(id, requestIdentity.requireUser().actor()));
    }

    @POST
    @Path("/formulas/{id}/activar")
    public Response activarFormula(@PathParam("id") Long id, FormulaLifecycleRequest request) {
        return ejecutarCambioEstado(() -> catalogoFormulas.activar(id, requestIdentity.requireUser().actor()));
    }

    private Response ejecutarCambioEstado(java.util.function.Supplier<FormulaTemplateResponse> operation) {
        try {
            return Response.ok(operation.get()).build();
        } catch (NoSuchElementException error) {
            return Response.status(Response.Status.NOT_FOUND)
                .entity(Map.of("error", error.getMessage()))
                .build();
        } catch (IllegalArgumentException error) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(Map.of("error", error.getMessage()))
                .build();
        }
    }

    @POST
    @Path("/ejecutar")
    public Response ejecutar(CalculoRequest request) {
        CalculoResponse resultado = servicio.ejecutar(request);
        return switch (resultado.estado()) {
            case "EXITOSO" -> Response.ok(resultado).build();
            case "SOLICITUD_INVALIDA" -> Response.status(Response.Status.BAD_REQUEST).entity(resultado).build();
            case "FORMULA_NO_ENCONTRADA" -> Response.status(Response.Status.NOT_FOUND).entity(resultado).build();
            default -> Response.status(200).entity(resultado).build();
        };
    }
}
