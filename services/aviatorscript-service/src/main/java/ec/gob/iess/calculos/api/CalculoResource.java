package ec.gob.iess.calculos.api;

import ec.gob.iess.calculos.dto.CalculoRequest;
import ec.gob.iess.calculos.dto.CalculoResponse;
import ec.gob.iess.calculos.service.AviatorCalculationService;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/calculos")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class CalculoResource {

    @Inject AviatorCalculationService servicio;

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
