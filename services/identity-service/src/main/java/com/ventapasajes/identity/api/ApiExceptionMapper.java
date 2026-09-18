package com.ventapasajes.identity.api;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

@Provider
public class ApiExceptionMapper implements ExceptionMapper<ApiException> {

    @Override
    public Response toResponse(ApiException exception) {
        return Response.status(exception.status())
                .entity(ApiErrorResponse.of(exception.code(), exception.getMessage()))
                .build();
    }
}
