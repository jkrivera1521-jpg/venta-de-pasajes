package com.ventapasajes.identity.auth;

import java.io.IOException;
import java.lang.reflect.Method;
import java.util.Arrays;

import com.ventapasajes.identity.api.ApiErrorResponse;
import com.ventapasajes.identity.api.ApiException;

import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;

@Provider
@Priority(Priorities.AUTHENTICATION)
public class BearerAuthFilter implements ContainerRequestFilter {

    @Context
    ResourceInfo resourceInfo;

    @Inject
    JwtService jwtService;

    @Inject
    RequestIdentity requestIdentity;

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        RequiresPermission required = requiredPermission();
        if (required == null) {
            return;
        }

        String authorization = requestContext.getHeaderString(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            abort(requestContext, Response.Status.UNAUTHORIZED, "UNAUTHORIZED", "Bearer token is required.");
            return;
        }

        AuthenticatedUser user;
        try {
            user = jwtService.verify(authorization.substring(7).trim());
        } catch (ApiException exception) {
            abort(requestContext, exception.status(), exception.code(), exception.getMessage());
            return;
        }

        requestIdentity.setUser(user);
        boolean missingPermission = Arrays.stream(required.value())
                .filter(permission -> permission != null && !permission.isBlank())
                .anyMatch(permission -> !user.hasPermission(permission));
        if (missingPermission) {
            abort(requestContext, Response.Status.FORBIDDEN, "FORBIDDEN", "The authenticated user lacks the required permission.");
        }
    }

    private RequiresPermission requiredPermission() {
        if (resourceInfo == null) {
            return null;
        }
        Method method = resourceInfo.getResourceMethod();
        if (method != null && method.isAnnotationPresent(RequiresPermission.class)) {
            return method.getAnnotation(RequiresPermission.class);
        }
        Class<?> resourceClass = resourceInfo.getResourceClass();
        if (resourceClass != null && resourceClass.isAnnotationPresent(RequiresPermission.class)) {
            return resourceClass.getAnnotation(RequiresPermission.class);
        }
        return null;
    }

    private void abort(ContainerRequestContext requestContext, Response.Status status, String code, String message) {
        requestContext.abortWith(Response.status(status)
                .entity(ApiErrorResponse.of(code, message))
                .build());
    }
}
