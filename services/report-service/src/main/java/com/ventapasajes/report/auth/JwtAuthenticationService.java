package com.ventapasajes.report.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class JwtAuthenticationService {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() { };

    @Inject ObjectMapper objectMapper;
    @ConfigProperty(name = "app.security.jwt-signing-secret") String signingSecret;
    @ConfigProperty(name = "app.security.jwt.issuer") String issuer;
    @ConfigProperty(name = "app.security.jwt.audience") String audience;

    public AuthenticatedUser verify(String token) {
        if (token == null || token.isBlank()) throw invalid("El token de acceso esta vacio.");
        String[] parts = token.split("\\.");
        if (parts.length != 3) throw invalid("El formato del token de acceso no es valido.");
        Map<String, Object> header = decode(parts[0]);
        if (!"HS256".equals(header.get("alg")) || !"JWT".equals(header.get("typ"))) {
            throw invalid("El algoritmo del token no es valido.");
        }
        String expected = sign(parts[0] + "." + parts[1]);
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), parts[2].getBytes(StandardCharsets.US_ASCII))) {
            throw invalid("La firma del token no es valida.");
        }
        Map<String, Object> claims = decode(parts[1]);
        if (!issuer.equals(claims.get("iss")) || !audience.equals(claims.get("aud"))) throw invalid("El token no pertenece a este servicio.");
        Object exp = claims.get("exp");
        if (!(exp instanceof Number number) || number.longValue() <= Instant.now().getEpochSecond()) throw new AuthenticationException("TOKEN_EXPIRED", "El token de acceso ha expirado.");
        String subject = required(claims, "sub");
        String login = required(claims, "login");
        return new AuthenticatedUser(subject, login, optional(claims, "email"), optional(claims, "name"), strings(claims.get("roles")), strings(claims.get("permissions")));
    }

    private Map<String, Object> decode(String value) {
        try { return objectMapper.readValue(Base64.getUrlDecoder().decode(value), MAP_TYPE); }
        catch (Exception error) { throw invalid("El contenido del token no es valido."); }
    }

    private String required(Map<String, Object> claims, String key) {
        String value = optional(claims, key);
        if (value == null || value.isBlank()) throw invalid("El claim " + key + " es obligatorio.");
        return value;
    }

    private String optional(Map<String, Object> claims, String key) { return claims.get(key) == null ? null : claims.get(key).toString(); }
    private List<String> strings(Object value) { return value instanceof List<?> list ? list.stream().map(Object::toString).toList() : List.of(); }
    private AuthenticationException invalid(String message) { return new AuthenticationException("INVALID_TOKEN", message); }

    private String sign(String input) {
        try {
            byte[] secret = signingSecret.getBytes(StandardCharsets.UTF_8);
            if (secret.length < 32) throw new IllegalStateException("El secreto JWT debe tener al menos 32 bytes.");
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(input.getBytes(StandardCharsets.US_ASCII)));
        } catch (Exception error) { throw new IllegalStateException("No se pudo verificar la firma JWT.", error); }
    }

    public static class AuthenticationException extends RuntimeException {
        private final String code;
        public AuthenticationException(String code, String message) { super(message); this.code = code; }
        public String code() { return code; }
    }
}
