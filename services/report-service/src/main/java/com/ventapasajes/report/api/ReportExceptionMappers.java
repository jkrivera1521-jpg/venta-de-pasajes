package com.ventapasajes.report.api;

import java.util.UUID;

import com.ventapasajes.report.api.dto.ApiProblem;

import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

@Provider
public class ReportExceptionMappers implements ExceptionMapper<ReportServiceException> {

    @Override
    public Response toResponse(ReportServiceException error) {
        return Response.status(error.status())
                .type(MediaType.valueOf("application/problem+json"))
                .entity(problem(error.status(), error.code(), error.getMessage()))
                .build();
    }

    private ApiProblem problem(int status, String code, String detail) {
        return new ApiProblem(
                "https://venta-pasajes/problems/" + code.toLowerCase(),
                "Report service request failed",
                status,
                code,
                detail,
                UUID.randomUUID().toString());
    }
}

@Provider
class ConstraintViolationProblemMapper implements ExceptionMapper<ConstraintViolationException> {
    @Override
    public Response toResponse(ConstraintViolationException error) {
        return Response.status(Response.Status.BAD_REQUEST)
                .type(MediaType.valueOf("application/problem+json"))
                .entity(new ApiProblem(
                        "https://venta-pasajes/problems/invalid-request",
                        "Invalid request",
                        400,
                        "INVALID_REQUEST",
                        "La solicitud no cumple las validaciones requeridas.",
                        UUID.randomUUID().toString()))
                .build();
    }
}
