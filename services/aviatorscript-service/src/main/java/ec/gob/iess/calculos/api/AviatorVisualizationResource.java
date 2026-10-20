package ec.gob.iess.calculos.api;

import ec.gob.iess.calculos.dto.AviatorVisualizationRequest;
import ec.gob.iess.calculos.dto.AviatorVisualizationResponse;
import ec.gob.iess.calculos.service.AviatorVisualizationService;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/aviator")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class AviatorVisualizationResource {

    private static final int MAX_SOURCE_LENGTH = 10_000;

    @Inject AviatorVisualizationService service;

    @POST
    @Path("/visualize")
    public Response visualize(AviatorVisualizationRequest request) {
        if (request == null || request.source() == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(java.util.Map.of("error", "El campo source es obligatorio."))
                    .build();
        }
        if (request.source().length() > MAX_SOURCE_LENGTH) {
            return Response.status(Response.Status.REQUEST_ENTITY_TOO_LARGE)
                    .entity(java.util.Map.of("error", "El codigo supera el limite de " + MAX_SOURCE_LENGTH + " caracteres."))
                    .build();
        }
        return Response.ok(service.analyze(request.source(), !Boolean.FALSE.equals(request.includeSourceMapping()))).build();
    }
}
