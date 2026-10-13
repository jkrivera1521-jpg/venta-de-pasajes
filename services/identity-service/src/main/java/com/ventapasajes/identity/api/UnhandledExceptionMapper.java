package com.ventapasajes.identity.api;

import org.jboss.logging.Logger;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

@Provider
public class UnhandledExceptionMapper implements ExceptionMapper<Exception> {

    private static final Logger LOG = Logger.getLogger(UnhandledExceptionMapper.class);

    @Override
    public Response toResponse(Exception exception) {
        if (exception instanceof WebApplicationException webException) {
            Response sourceResponse = webException.getResponse();
            int status = sourceResponse == null
                    ? Response.Status.INTERNAL_SERVER_ERROR.getStatusCode()
                    : sourceResponse.getStatus();
            return Response.status(status)
                    .entity(ApiErrorResponse.of("HTTP_ERROR", messageForStatus(status)))
                    .type(MediaType.APPLICATION_JSON)
                    .build();
        }

        LOG.error("Unhandled identity-service error", exception);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiErrorResponse.of("INTERNAL_ERROR", "identity-service no pudo completar la operacion. Revisa los logs del servicio."))
                .type(MediaType.APPLICATION_JSON)
                .build();
    }

    private String messageForStatus(int status) {
        return switch (status) {
            case 400 -> "La solicitud enviada a identity-service no es valida.";
            case 401 -> "Sesion no disponible o token invalido.";
            case 403 -> "No tienes permisos para ejecutar esta accion.";
            case 404 -> "El endpoint solicitado no existe en identity-service.";
            case 405 -> "El metodo HTTP no esta permitido para este endpoint.";
            default -> "identity-service respondio con HTTP " + status + ".";
        };
    }
}
