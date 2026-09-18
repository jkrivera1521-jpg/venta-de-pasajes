package com.ventapasajes.identity.auth;

import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.ventapasajes.identity.api.ApiException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class GoogleIdTokenVerifier {

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Inject
    ObjectMapper objectMapper;

    @ConfigProperty(name = "app.auth.google.client-ids", defaultValue = "")
    String clientIdsCsv;

    @ConfigProperty(name = "app.auth.google.allowed-issuers", defaultValue = "https://accounts.google.com,accounts.google.com")
    String allowedIssuersCsv;

    @ConfigProperty(name = "app.auth.google.jwks-url", defaultValue = "https://www.googleapis.com/oauth2/v3/certs")
    String jwksUrl;

    @ConfigProperty(name = "app.auth.google.signature-required", defaultValue = "true")
    boolean signatureRequired;

    @ConfigProperty(name = "app.auth.google.dev-token.enabled", defaultValue = "false")
    boolean devTokenEnabled;

    Clock clock = Clock.systemUTC();

    public GooglePrincipal verify(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            throw ApiException.unauthorized("GOOGLE_TOKEN_EMPTY", "Google ID token is required.");
        }
        if (idToken.startsWith("dev-google:")) {
            if (!devTokenEnabled) {
                throw ApiException.unauthorized("GOOGLE_DEV_TOKEN_DISABLED", "Development Google token support is disabled.");
            }
            return validateClaims(parseDevClaims(idToken));
        }

        String[] parts = idToken.split("\\.");
        if (parts.length != 3) {
            throw ApiException.unauthorized("GOOGLE_TOKEN_INVALID", "Google ID token format is invalid.");
        }
        JsonNode header = parseBase64Json(parts[0], "header");
        JsonNode claims = parseBase64Json(parts[1], "payload");
        if (signatureRequired) {
            verifyRs256Signature(header, parts[0] + "." + parts[1], parts[2]);
        }
        return validateClaims(claims);
    }

    public String createDevelopmentToken(String subject, String email, String displayName, String audience) {
        if (!devTokenEnabled) {
            throw ApiException.validation("GOOGLE_DEV_TOKEN_DISABLED", "Development Google token support is disabled.");
        }
        long now = Instant.now(clock).getEpochSecond();
        try {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("iss", "https://accounts.google.com");
            node.put("aud", audience);
            node.put("sub", subject);
            node.put("email", email);
            node.put("email_verified", true);
            node.put("name", displayName);
            node.put("exp", now + 3600);
            String payload = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(objectMapper.writeValueAsBytes(node));
            return "dev-google:" + payload;
        } catch (Exception exception) {
            throw new IllegalStateException("Could not create development Google token.", exception);
        }
    }

    private GooglePrincipal validateClaims(JsonNode claims) {
        String issuer = requiredText(claims, "iss");
        if (!csvValues(allowedIssuersCsv).contains(issuer)) {
            throw ApiException.unauthorized("GOOGLE_ISSUER_INVALID", "Google ID token issuer is not trusted.");
        }

        String audience = requiredText(claims, "aud");
        List<String> clientIds = csvValues(clientIdsCsv);
        if (clientIds.isEmpty() || !clientIds.contains(audience)) {
            throw ApiException.unauthorized("GOOGLE_AUDIENCE_INVALID", "Google ID token audience is not authorized.");
        }

        long expiresAt = requiredLong(claims, "exp");
        if (expiresAt <= Instant.now(clock).getEpochSecond()) {
            throw ApiException.unauthorized("GOOGLE_TOKEN_EXPIRED", "Google ID token is expired.");
        }

        boolean emailVerified = claims.path("email_verified").asBoolean(false);
        if (!emailVerified) {
            throw ApiException.unauthorized("GOOGLE_EMAIL_NOT_VERIFIED", "Google account email is not verified.");
        }

        return new GooglePrincipal(
                requiredText(claims, "sub"),
                requiredText(claims, "email").toLowerCase(),
                emailVerified,
                optionalText(claims, "name"),
                optionalText(claims, "hd"),
                Instant.ofEpochSecond(expiresAt));
    }

    private void verifyRs256Signature(JsonNode header, String signingInput, String signaturePart) {
        if (!"RS256".equals(requiredText(header, "alg"))) {
            throw ApiException.unauthorized("GOOGLE_SIGNATURE_INVALID", "Google ID token algorithm is not RS256.");
        }
        String keyId = requiredText(header, "kid");
        JsonNode key = findJwk(keyId);
        try {
            BigInteger modulus = new BigInteger(1, decodeUrl(requiredText(key, "n")));
            BigInteger exponent = new BigInteger(1, decodeUrl(requiredText(key, "e")));
            RSAPublicKey publicKey = (RSAPublicKey) KeyFactory.getInstance("RSA")
                    .generatePublic(new RSAPublicKeySpec(modulus, exponent));
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(publicKey);
            verifier.update(signingInput.getBytes(StandardCharsets.US_ASCII));
            if (!verifier.verify(decodeUrl(signaturePart))) {
                throw ApiException.unauthorized("GOOGLE_SIGNATURE_INVALID", "Google ID token signature is invalid.");
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw ApiException.unauthorized("GOOGLE_SIGNATURE_INVALID", "Google ID token signature could not be verified.");
        }
    }

    private JsonNode findJwk(String keyId) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(jwksUrl)).GET().build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                throw ApiException.unauthorized("GOOGLE_JWKS_UNAVAILABLE", "Google signing keys are unavailable.");
            }
            JsonNode keys = objectMapper.readTree(response.body()).path("keys");
            for (JsonNode key : keys) {
                if (keyId.equals(key.path("kid").asText())) {
                    return key;
                }
            }
            throw ApiException.unauthorized("GOOGLE_KEY_NOT_FOUND", "Google signing key was not found.");
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw ApiException.unauthorized("GOOGLE_JWKS_UNAVAILABLE", "Google signing keys could not be loaded.");
        }
    }

    private JsonNode parseDevClaims(String token) {
        return parseBase64Json(token.substring("dev-google:".length()), "development payload");
    }

    private JsonNode parseBase64Json(String value, String partName) {
        try {
            return objectMapper.readTree(decodeUrl(value));
        } catch (Exception exception) {
            throw ApiException.unauthorized("GOOGLE_TOKEN_INVALID", "Google ID token " + partName + " is invalid.");
        }
    }

    private String requiredText(JsonNode node, String name) {
        String value = optionalText(node, name);
        if (value == null || value.isBlank()) {
            throw ApiException.unauthorized("GOOGLE_TOKEN_INVALID", "Google ID token claim is missing: " + name + ".");
        }
        return value;
    }

    private String optionalText(JsonNode node, String name) {
        JsonNode value = node.get(name);
        return value == null || value.isNull() ? null : value.asText();
    }

    private long requiredLong(JsonNode node, String name) {
        JsonNode value = node.get(name);
        if (value == null || !value.canConvertToLong()) {
            throw ApiException.unauthorized("GOOGLE_TOKEN_INVALID", "Google ID token claim is missing: " + name + ".");
        }
        return value.asLong();
    }

    private byte[] decodeUrl(String value) {
        return Base64.getUrlDecoder().decode(value.getBytes(StandardCharsets.US_ASCII));
    }

    private List<String> csvValues(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toList();
    }

    public record GooglePrincipal(
            String subject,
            String email,
            boolean emailVerified,
            String displayName,
            String hostedDomain,
            Instant expiresAt) {
    }

}
