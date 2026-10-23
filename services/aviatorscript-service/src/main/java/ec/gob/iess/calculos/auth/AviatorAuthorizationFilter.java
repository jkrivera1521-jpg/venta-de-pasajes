package ec.gob.iess.calculos.auth;

import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;
import java.util.Locale;

/** Protects Aviator APIs with the permissions carried by the identity-service JWT. */
@Provider
@Priority(Priorities.AUTHENTICATION)
public class AviatorAuthorizationFilter implements ContainerRequestFilter {

    @Inject JwtAuthenticationService jwtAuthenticationService;
    @Inject RequestIdentity requestIdentity;

    @Override
    public void filter(ContainerRequestContext context) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(context.getMethod())) {
            return;
        }

        String path = normalizePath(context.getUriInfo().getPath());
        if (!isAviatorApi(path)) {
            return;
        }

        String authorization = context.getHeaderString(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            abort(context, Response.Status.UNAUTHORIZED, "UNAUTHORIZED", "Se requiere un token Bearer para usar AviatorScript.");
            return;
        }

        AuthenticatedUser user;
        try {
            user = jwtAuthenticationService.verify(authorization.substring(7).trim());
        } catch (JwtAuthenticationService.AuthenticationException error) {
            abort(context, Response.Status.UNAUTHORIZED, error.code(), error.getMessage());
            return;
        }

        requestIdentity.setUser(user);
        String permission = permissionFor(context.getMethod(), path);
        if (permission != null && !user.hasPermission(permission)) {
            abort(context, Response.Status.FORBIDDEN, "FORBIDDEN", "El usuario autenticado no tiene el permiso requerido.");
        }
    }

    private boolean isAviatorApi(String path) {
        return path.equals("api/v1/calculos")
                || path.startsWith("api/v1/calculos/")
                || path.equals("api/v1/aviator")
                || path.startsWith("api/v1/aviator/");
    }

    private String permissionFor(String method, String path) {
        String normalizedMethod = method.toUpperCase(Locale.ROOT);
        if (path.equals("api/v1/calculos/formulas") && "GET".equals(normalizedMethod)) {
            return "aviatorscript.formulas.read";
        }
        if (path.equals("api/v1/calculos/formulas") && "POST".equals(normalizedMethod)) {
            return "aviatorscript.formulas.write";
        }
        if (path.matches("api/v1/calculos/formulas/\\d+/publicar") && "POST".equals(normalizedMethod)) {
            return "aviatorscript.formulas.publish";
        }
        if (path.matches("api/v1/calculos/formulas/\\d+/activar") && "POST".equals(normalizedMethod)) {
            return "aviatorscript.formulas.activate";
        }
        if (path.equals("api/v1/calculos/ejecutar") || path.equals("api/v1/calculos/endpoint")) {
            return "aviatorscript.formulas.execute";
        }
        if (path.equals("api/v1/calculos/validar") && "POST".equals(normalizedMethod)) {
            return "aviatorscript.formulas.validate";
        }
        if (path.equals("api/v1/calculos/probar") && "POST".equals(normalizedMethod)) {
            return "aviatorscript.formulas.test";
        }
        if (path.equals("api/v1/aviator/visualize") && "POST".equals(normalizedMethod)) {
            return "aviatorscript.formulas.visualize";
        }
        return null;
    }

    private String normalizePath(String value) {
        return value == null ? "" : value.replaceAll("^/+|/+$", "");
    }

    private void abort(ContainerRequestContext context, Response.Status status, String code, String message) {
        context.abortWith(Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity("{\"error\":{\"code\":\"" + escape(code) + "\",\"message\":\"" + escape(message) + "\"}}")
                .build());
    }

    private String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\r", "\\r").replace("\n", "\\n");
    }
}
