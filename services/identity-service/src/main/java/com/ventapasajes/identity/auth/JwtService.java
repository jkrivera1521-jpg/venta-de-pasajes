package com.ventapasajes.identity.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.identity.api.ApiException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class JwtService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    @Inject
    ObjectMapper objectMapper;

    @ConfigProperty(name = "app.security.jwt-signing-secret")
    String signingSecret;

    @ConfigProperty(name = "app.security.jwt.issuer")
    String issuer;

    @ConfigProperty(name = "app.security.jwt.audience")
    String audience;

    @ConfigProperty(name = "app.security.jwt.access-token-ttl-seconds")
    long accessTokenTtlSeconds;

    Clock clock = Clock.systemUTC();

    public String issueAccessToken(AuthenticatedUser user) {
        Instant now = Instant.now(clock);
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("iss", issuer);
        claims.put("aud", audience);
        claims.put("sub", user.id().toString());
        claims.put("login", user.login());
        claims.put("email", user.email());
        claims.put("name", user.displayName());
        claims.put("roles", user.roles());
        claims.put("permissions", user.permissions());
        claims.put("iat", now.getEpochSecond());
        claims.put("exp", now.plusSeconds(accessTokenTtlSeconds).getEpochSecond());

        String header = encodeJson(Map.of("typ", "JWT", "alg", "HS256"));
        String payload = encodeJson(claims);
        String signingInput = header + "." + payload;
        return signingInput + "." + sign(signingInput);
    }

    public AuthenticatedUser verify(String token) {
        if (token == null || token.isBlank()) {
            throw ApiException.unauthorized("INVALID_TOKEN", "Token is empty.");
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw ApiException.unauthorized("INVALID_TOKEN", "Token format is invalid.");
        }

        String signingInput = parts[0] + "." + parts[1];
        if (!MessageDigest.isEqual(sign(signingInput).getBytes(StandardCharsets.US_ASCII),
                parts[2].getBytes(StandardCharsets.US_ASCII))) {
            throw ApiException.unauthorized("INVALID_TOKEN", "Token signature is invalid.");
        }

        Map<String, Object> claims = decodeJson(parts[1]);
        assertClaimEquals(claims, "iss", issuer);
        assertClaimEquals(claims, "aud", audience);
        long expiresAt = numberClaim(claims, "exp");
        if (expiresAt <= Instant.now(clock).getEpochSecond()) {
            throw ApiException.unauthorized("TOKEN_EXPIRED", "Token is expired.");
        }

        return new AuthenticatedUser(
                UUID.fromString(requiredString(claims, "sub")),
                requiredString(claims, "login"),
                optionalString(claims, "email"),
                optionalString(claims, "name"),
                stringList(claims.get("roles")),
                stringList(claims.get("permissions")));
    }

    public long accessTokenTtlSeconds() {
        return accessTokenTtlSeconds;
    }

    private void assertClaimEquals(Map<String, Object> claims, String name, String expected) {
        if (!expected.equals(claims.get(name))) {
            throw ApiException.unauthorized("INVALID_TOKEN", "Token claim is invalid: " + name + ".");
        }
    }

    private long numberClaim(Map<String, Object> claims, String name) {
        Object value = claims.get(name);
        if (value instanceof Number number) {
            return number.longValue();
        }
        throw ApiException.unauthorized("INVALID_TOKEN", "Token claim is missing: " + name + ".");
    }

    private String requiredString(Map<String, Object> claims, String name) {
        String value = optionalString(claims, name);
        if (value == null || value.isBlank()) {
            throw ApiException.unauthorized("INVALID_TOKEN", "Token claim is missing: " + name + ".");
        }
        return value;
    }

    private String optionalString(Map<String, Object> claims, String name) {
        Object value = claims.get(name);
        return value == null ? null : value.toString();
    }

    private List<String> stringList(Object value) {
        if (value instanceof List<?> list) {
            return list.stream().map(Object::toString).toList();
        }
        return List.of();
    }

    private String encodeJson(Object value) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(objectMapper.writeValueAsBytes(value));
        } catch (Exception exception) {
            throw new IllegalStateException("Could not encode JWT JSON.", exception);
        }
    }

    private Map<String, Object> decodeJson(String encoded) {
        try {
            byte[] json = Base64.getUrlDecoder().decode(encoded);
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception exception) {
            throw ApiException.unauthorized("INVALID_TOKEN", "Token payload is invalid.");
        }
    }

    private String sign(String signingInput) {
        byte[] secret = signingSecret.getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw ApiException.unauthorized("JWT_SECRET_NOT_CONFIGURED", "JWT signing secret must be at least 32 bytes.");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(signingInput.getBytes(StandardCharsets.US_ASCII)));
        } catch (Exception exception) {
            throw new IllegalStateException("JWT signing failed.", exception);
        }
    }
}
