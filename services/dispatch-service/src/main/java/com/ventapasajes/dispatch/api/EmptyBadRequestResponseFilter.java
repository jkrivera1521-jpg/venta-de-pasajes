package com.ventapasajes.dispatch.api;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.ext.Provider;

@Provider
public class EmptyBadRequestResponseFilter implements ContainerResponseFilter {

    @Override
    public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
        if (responseContext.getStatus() == 400 && !responseContext.hasEntity()) {
            responseContext.setEntity(ApiErrorResponse.of("BAD_REQUEST", "Request body or parameters are invalid."));
            responseContext.getHeaders().putSingle(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON);
        }
    }
}
