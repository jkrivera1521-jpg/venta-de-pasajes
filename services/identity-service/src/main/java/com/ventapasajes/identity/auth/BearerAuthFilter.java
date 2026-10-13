package com.ventapasajes.identity.auth;

import java.io.IOException;
import java.util.Arrays;
import java.util.Locale;

import com.ventapasajes.identity.api.ApiException;

import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;

@Provider
@Priority(Priorities.AUTHENTICATION)
public class BearerAuthFilter implements ContainerRequestFilter {

    @Inject
    JwtService jwtService;

    @Inject
    RequestIdentity requestIdentity;

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        RequiredAccess required = requiredAccess(requestContext);
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
        boolean missingPermission = Arrays.stream(required.permissions())
                .filter(permission -> permission != null && !permission.isBlank())
                .anyMatch(permission -> !user.hasPermission(permission));
        if (missingPermission) {
            abort(requestContext, Response.Status.FORBIDDEN, "FORBIDDEN", "The authenticated user lacks the required permission.");
        }
    }

    private RequiredAccess requiredAccess(ContainerRequestContext requestContext) {
        String method = requestContext.getMethod().toUpperCase(Locale.ROOT);
        String path = requestContext.getUriInfo().getPath().replaceAll("^/+|/+$", "");
        String basePath = "api/v1/identity";
        if (!path.equals(basePath) && !path.startsWith(basePath + "/")) {
            return null;
        }

        String resourcePath = path.length() == basePath.length() ? "" : path.substring(basePath.length() + 1);
        if (resourcePath.isBlank()
                || resourcePath.equals("health")
                || resourcePath.equals("auth/local/login")
                || resourcePath.equals("auth/local/register")
                || resourcePath.equals("auth/google/exchange")
                || resourcePath.equals("password/forgot")
                || resourcePath.equals("password/login")
                || resourcePath.equals("password/reset")) {
            return null;
        }

        if (resourcePath.equals("auth/logout") || resourcePath.equals("me")) {
            return RequiredAccess.authenticated();
        }

        if (resourcePath.equals("users")) {
            if ("GET".equals(method)) {
                return RequiredAccess.permission("identity.users.read");
            }
            if ("POST".equals(method)) {
                return RequiredAccess.permission("identity.users.write");
            }
        }

        if (resourcePath.matches("users/[^/]+")) {
            if ("GET".equals(method)) {
                return RequiredAccess.permission("identity.users.read");
            }
            if ("PATCH".equals(method)) {
                return RequiredAccess.permission("identity.users.write");
            }
        }

        if (resourcePath.matches("users/[^/]+/roles") && "PUT".equals(method)) {
            return RequiredAccess.permission("identity.roles.manage");
        }

        if (resourcePath.matches("users/[^/]+/(activate|suspend)") && "POST".equals(method)) {
            return RequiredAccess.permission("identity.users.status");
        }

        if (resourcePath.equals("roles")) {
            if ("GET".equals(method)) {
                return RequiredAccess.permission("identity.roles.read");
            }
            if ("POST".equals(method)) {
                return RequiredAccess.permission("identity.roles.manage");
            }
        }

        if (resourcePath.matches("roles/[^/]+") && ("PATCH".equals(method) || "PUT".equals(method) || "DELETE".equals(method))) {
            return RequiredAccess.permission("identity.roles.manage");
        }

        if (resourcePath.equals("permissions") && "GET".equals(method)) {
            return RequiredAccess.permission("identity.permissions.read");
        }

        return null;
    }

    private void abort(ContainerRequestContext requestContext, Response.Status status, String code, String message) {
        requestContext.abortWith(Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(errorJson(code, message))
                .build());
    }

    private String errorJson(String code, String message) {
        return "{\"error\":{\"code\":\"" + jsonEscape(code) + "\",\"message\":\"" + jsonEscape(message) + "\"}}";
    }

    private String jsonEscape(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\r", "\\r")
                .replace("\n", "\\n")
                .replace("\t", "\\t");
    }

    private record RequiredAccess(String[] permissions) {

        static RequiredAccess authenticated() {
            return new RequiredAccess(new String[0]);
        }

        static RequiredAccess permission(String permission) {
            return new RequiredAccess(new String[] { permission });
        }
    }
}
