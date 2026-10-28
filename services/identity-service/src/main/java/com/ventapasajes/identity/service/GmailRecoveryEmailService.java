package com.ventapasajes.identity.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import javax.net.ssl.HttpsURLConnection;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.identity.api.ApiException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class GmailRecoveryEmailService {

    private static final Logger LOG = Logger.getLogger(GmailRecoveryEmailService.class);
    private static final String TOKEN_GRANT_TYPE = "refresh_token";
    private static final int CONNECT_TIMEOUT_MILLIS = 10_000;
    private static final int READ_TIMEOUT_MILLIS = 20_000;

    @Inject
    ObjectMapper objectMapper;

    @ConfigProperty(name = "app.gmail.enabled", defaultValue = "false")
    boolean enabled;

    @ConfigProperty(name = "app.gmail.client-id", defaultValue = "")
    Optional<String> clientId;

    @ConfigProperty(name = "app.gmail.client-secret", defaultValue = "")
    Optional<String> clientSecret;

    @ConfigProperty(name = "app.gmail.refresh-token", defaultValue = "")
    Optional<String> refreshToken;

    @ConfigProperty(name = "app.gmail.sender-email", defaultValue = "")
    Optional<String> senderEmail;

    @ConfigProperty(name = "app.gmail.token-url", defaultValue = "https://oauth2.googleapis.com/token")
    String tokenUrl;

    @ConfigProperty(name = "app.gmail.send-url", defaultValue = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
    String sendUrl;

    public boolean isEnabled() {
        return enabled;
    }

    public void sendPasswordRecoveryEmail(String recipientEmail, String displayName, String recoveryLink, long ttlMinutes) {
        sendRecoveryEmail(
                recipientEmail,
                displayName,
                recoveryLink,
                ttlMinutes,
                "Recuperacion de contrasena - Panamericana Internacional",
                "Recuperacion de contrasena",
                "Recibimos una solicitud para restablecer tu contrasena en Panamericana Internacional.",
                "Crear nueva contrasena");
    }

    public void sendAccessRecoveryEmail(String recipientEmail, String displayName, String accessLink, long ttlMinutes) {
        sendRecoveryEmail(
                recipientEmail,
                displayName,
                accessLink,
                ttlMinutes,
                "Acceso seguro - Panamericana Internacional",
                "Acceso seguro",
                "Recibimos una solicitud para ingresar a Panamericana Internacional con tu cuenta Google registrada.",
                "Ingresar a la plataforma");
    }

    private void sendRecoveryEmail(String recipientEmail, String displayName, String actionLink, long ttlMinutes, String subject, String title, String body, String buttonText) {
        if (!enabled) {
            throw ApiException.validation("GMAIL_DISABLED", "Gmail API no esta habilitada en identity-service. Configura APP_GMAIL_ENABLED=true y reinicia el servicio.");
        }

        ensureConfigured();

        try {
            String accessToken = requestAccessToken();
            String rawMessage = encodeMimeMessage(recipientEmail, displayName, actionLink, ttlMinutes, subject, title, body, buttonText);
            String payload = objectMapper.writeValueAsString(Map.of("raw", rawMessage));

            HttpResult response = post(sendUrl, "application/json", payload, Map.of("Authorization", "Bearer " + accessToken));

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOG.warnf("Gmail send failed. status=%d body=%s", response.statusCode(), truncate(response.body()));
                throw ApiException.badGateway("GMAIL_SEND_FAILED", "Gmail API no acepto el correo de recuperacion. Revisa remitente, scopes y permisos.");
            }

            if (!hasSentLabel(response.body())) {
                LOG.warnf("Gmail send was not confirmed with SENT label. body=%s", truncate(response.body()));
                throw ApiException.badGateway("GMAIL_SEND_NOT_CONFIRMED", "Gmail API no confirmo el envio del correo.");
            }
        } catch (IOException exception) {
            LOG.warn("Could not connect to Gmail API", exception);
            throw ApiException.badGateway("GMAIL_SEND_FAILED", "No se pudo conectar a Gmail API: " + exception.getClass().getSimpleName() + " - " + exception.getMessage());
        }
    }

    private String requestAccessToken() throws IOException {
        String form = form(Map.of(
                "client_id", configValue(clientId),
                "client_secret", configValue(clientSecret),
                "refresh_token", configValue(refreshToken),
                "grant_type", TOKEN_GRANT_TYPE));

        HttpResult response = post(tokenUrl, "application/x-www-form-urlencoded", form, Map.of());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            LOG.warnf("Gmail token request failed. status=%d body=%s", response.statusCode(), truncate(response.body()));
            throw ApiException.badGateway("GMAIL_TOKEN_FAILED", "Google OAuth no emitio un access token para Gmail API.");
        }

        JsonNode root = objectMapper.readTree(response.body());
        String accessToken = root.path("access_token").asText("");
        if (accessToken.isBlank()) {
            throw ApiException.badGateway("GMAIL_TOKEN_FAILED", "Gmail API response did not include an access token.");
        }
        return accessToken;
    }

    private String encodeMimeMessage(String recipientEmail, String displayName, String actionLink, long ttlMinutes, String subject, String title, String body, String buttonText) {
        String safeName = displayName == null || displayName.isBlank() ? "usuario" : escapeHtml(displayName);
        String safeLink = escapeHtml(actionLink);
        String safeTitle = escapeHtml(title);
        String safeBody = escapeHtml(body);
        String safeButtonText = escapeHtml(buttonText);
        String html = """
                <html>
                  <body style="font-family:Arial,sans-serif;color:#24151a;line-height:1.5">
                    <h2 style="color:#3a0713">%s</h2>
                    <p>Hola %s,</p>
                    <p>%s</p>
                    <p>
                      <a href="%s" style="background:#b91c35;color:#ffffff;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:700">
                        %s
                      </a>
                    </p>
                    <p>Este enlace vence en %d minutos y solo puede usarse una vez. Si no solicitaste esta accion, ignora este correo.</p>
                  </body>
                </html>
                """.formatted(safeTitle, safeName, safeBody, safeLink, safeButtonText, ttlMinutes);

        String safeSender = headerValue(configValue(senderEmail));
        String safeRecipient = headerValue(recipientEmail);
        String mime = String.join("\r\n",
                "From: Panamericana Internacional <" + safeSender + ">",
                "To: " + safeRecipient,
                "Subject: " + headerValue(subject),
                "MIME-Version: 1.0",
                "Content-Type: text/html; charset=UTF-8",
                "",
                html);

        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(mime.getBytes(StandardCharsets.UTF_8));
    }

    private void ensureConfigured() {
        if (isBlank(clientId) || isBlank(clientSecret) || isBlank(refreshToken) || isBlank(senderEmail)) {
            throw ApiException.validation("GMAIL_NOT_CONFIGURED", "Gmail API is enabled but its credentials are incomplete.");
        }
    }

    private boolean isBlank(Optional<String> value) {
        return value.isEmpty() || value.get().isBlank();
    }

    private String configValue(Optional<String> value) {
        return value.orElse("").trim();
    }

    private String form(Map<String, String> values) {
        return values.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .collect(Collectors.joining("&"));
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String escapeHtml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String headerValue(String value) {
        return value.replace("\r", "").replace("\n", "").trim();
    }

    private boolean hasSentLabel(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode labelIds = root.path("labelIds");
            if (!labelIds.isArray()) {
                return false;
            }

            for (JsonNode labelId : labelIds) {
                if ("SENT".equals(labelId.asText())) {
                    return true;
                }
            }
            return false;
        } catch (IOException exception) {
            LOG.warn("Gmail send response was not valid JSON", exception);
            throw ApiException.badGateway("GMAIL_SEND_UNVERIFIABLE", "Gmail API respondio sin un JSON valido de confirmacion.");
        }
    }

    private HttpResult post(String url, String contentType, String body, Map<String, String> headers) throws IOException {
        HttpsURLConnection connection = (HttpsURLConnection) URI.create(url).toURL().openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(CONNECT_TIMEOUT_MILLIS);
        connection.setReadTimeout(READ_TIMEOUT_MILLIS);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", contentType);
        headers.forEach(connection::setRequestProperty);

        try (OutputStream outputStream = connection.getOutputStream()) {
            outputStream.write(body.getBytes(StandardCharsets.UTF_8));
        }

        int statusCode = connection.getResponseCode();
        InputStream responseStream = statusCode >= HttpURLConnection.HTTP_BAD_REQUEST
                ? connection.getErrorStream()
                : connection.getInputStream();
        String responseBody = responseStream == null
                ? ""
                : new String(responseStream.readAllBytes(), StandardCharsets.UTF_8);
        connection.disconnect();
        return new HttpResult(statusCode, responseBody);
    }

    private String truncate(String value) {
        if (value == null) {
            return "";
        }
        return value.length() <= 500 ? value : value.substring(0, 500);
    }

    private record HttpResult(int statusCode, String body) {
    }
}
