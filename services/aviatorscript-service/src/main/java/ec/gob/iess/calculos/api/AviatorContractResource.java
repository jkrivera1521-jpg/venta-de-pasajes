package ec.gob.iess.calculos.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.googlecode.aviator.exception.StandardError;
import ec.gob.iess.calculos.dto.AviatorDiagnostic;
import ec.gob.iess.calculos.dto.AviatorSourceRequest;
import ec.gob.iess.calculos.dto.AviatorSourceTestRequest;
import ec.gob.iess.calculos.dto.AviatorSourceTestResponse;
import ec.gob.iess.calculos.dto.AviatorValidationResponse;
import ec.gob.iess.calculos.service.AviatorScriptEngine;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;

/** Canonical source validation and test endpoints used by the visual editor. */
@Path("/api/v1/calculos")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class AviatorContractResource {

    @Inject ObjectMapper objectMapper;

    @POST
    @Path("/validar")
    public Response validar(AviatorSourceRequest request) {
        if (request == null || request.source() == null) {
            return badRequest("El campo source es obligatorio.");
        }

        try {
            AviatorScriptEngine.compile(request.source());
            return Response.ok(new AviatorValidationResponse(
                AviatorScriptEngine.CONTRACT_VERSION,
                AviatorScriptEngine.ENGINE_ID,
                true,
                List.of()
            )).build();
        } catch (Exception error) {
            return Response.ok(new AviatorValidationResponse(
                AviatorScriptEngine.CONTRACT_VERSION,
                AviatorScriptEngine.ENGINE_ID,
                false,
                List.of(new AviatorDiagnostic(
                    "AVIATOR_COMPILE_ERROR",
                    safeMessage(error),
                    null,
                    null,
                    "error"
                ))
            )).build();
        }
    }

    @POST
    @Path("/probar")
    public Response probar(AviatorSourceTestRequest request) {
        if (request == null || request.source() == null) {
            return badRequest("El campo source es obligatorio.");
        }
        if (request.parametros() == null) {
            return badRequest("El mapa de parametros es obligatorio.");
        }

        long startedAt = System.nanoTime();
        try {
            Object value = AviatorScriptEngine.execute(request.source(), request.parametros());
            JsonNode result = objectMapper.valueToTree(value);
            return Response.ok(new AviatorSourceTestResponse(
                AviatorScriptEngine.CONTRACT_VERSION,
                AviatorScriptEngine.ENGINE_ID,
                true,
                result,
                elapsedMs(startedAt),
                null
            )).build();
        } catch (Exception error) {
            if (error instanceof IllegalArgumentException || error instanceof StandardError) {
                return Response.ok(failedTest(startedAt, safeMessage(error))).build();
            }
            return Response.ok(failedTest(startedAt, "No fue posible ejecutar la formula con AviatorScript.")).build();
        }
    }

    private AviatorSourceTestResponse failedTest(long startedAt, String error) {
        return new AviatorSourceTestResponse(
            AviatorScriptEngine.CONTRACT_VERSION,
            AviatorScriptEngine.ENGINE_ID,
            false,
            null,
            elapsedMs(startedAt),
            error
        );
    }

    private static long elapsedMs(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }

    private static String safeMessage(Throwable error) {
        String message = error.getMessage();
        return message == null || message.isBlank() ? "La formula no es valida para AviatorScript." : message;
    }

    private static Response badRequest(String message) {
        return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", message)).build();
    }
}
