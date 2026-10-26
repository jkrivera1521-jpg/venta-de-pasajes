package com.ventapasajes.report.auth;

import java.io.IOException;
import java.util.Locale;

import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

@Provider
@Priority(Priorities.AUTHENTICATION)
public class ReportAuthorizationFilter implements ContainerRequestFilter {
    private static final Logger LOG = Logger.getLogger(ReportAuthorizationFilter.class);

    @Inject JwtAuthenticationService jwt;
    @Inject RequestIdentity identity;

    @Override
    public void filter(ContainerRequestContext context) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(context.getMethod())) return;
        String path = context.getUriInfo().getPath().replaceAll("^/+|/+$", "");
        if (!isProtected(path)) return;
        String header = context.getHeaderString(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            LOG.warnf("Solicitud protegida rechazada sin Bearer: %s %s", context.getMethod(), path);
            abort(context, Response.Status.UNAUTHORIZED, "UNAUTHORIZED", "Se requiere un token Bearer.");
            return;
        }
        AuthenticatedUser user;
        try { user = jwt.verify(header.substring(7).trim()); }
        catch (JwtAuthenticationService.AuthenticationException error) {
            LOG.warnf("Token rechazado para %s %s: %s", context.getMethod(), path, error.code());
            abort(context, Response.Status.UNAUTHORIZED, error.code(), error.getMessage());
            return;
        }
        identity.setUser(user);
        String permission = permissionFor(context.getMethod(), path);
        if (permission != null && !user.hasPermission(permission)) {
            LOG.warnf("Permiso rechazado para %s en %s %s", permission, context.getMethod(), path);
            abort(context, Response.Status.FORBIDDEN, "FORBIDDEN", "El usuario no tiene el permiso requerido.");
        }
    }

    private boolean isProtected(String path) {
        return path.startsWith("api/v1/templates") || path.startsWith("api/v1/reports") || path.startsWith("api/v1/report-jobs");
    }

    private String permissionFor(String method, String path) {
        String m = method.toUpperCase(Locale.ROOT);
        if (path.matches("api/v1/templates/[^/]+/versions/[^/]+/activate") && "POST".equals(m)) return "REPORT_TEMPLATE_ACTIVATE";
        if (path.matches("api/v1/templates/[^/]+") && "DELETE".equals(m)) return "REPORT_TEMPLATE_UPDATE";
        if (path.equals("api/v1/templates") && "POST".equals(m)) return "REPORT_TEMPLATE_CREATE";
        if (path.startsWith("api/v1/templates") && "GET".equals(m)) return "REPORT_TEMPLATE_READ";
        if (path.equals("api/v1/reports/generate") && "POST".equals(m)) return "REPORT_GENERATE";
        if (path.equals("api/v1/report-jobs") && "POST".equals(m)) return "REPORT_BATCH_GENERATE";
        if (path.matches("api/v1/report-jobs/[^/]+/download") && "GET".equals(m)) return "REPORT_JOB_DOWNLOAD";
        if (path.startsWith("api/v1/report-jobs") && "GET".equals(m)) return "REPORT_BATCH_GENERATE";
        if (path.matches("api/v1/report-jobs/[^/]+/cancel") && "POST".equals(m)) return "REPORT_BATCH_GENERATE";
        return null;
    }

    private void abort(ContainerRequestContext context, Response.Status status, String code, String message) {
        String safe = message == null ? "" : message.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", "\\r").replace("\n", "\\n");
        context.abortWith(Response.status(status).type(MediaType.APPLICATION_JSON).entity("{\"error\":{\"code\":\"" + code + "\",\"message\":\"" + safe + "\"}}").build());
    }
}
