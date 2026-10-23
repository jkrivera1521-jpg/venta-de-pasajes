package ec.gob.iess.calculos.auth;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Verifies the HS256 access token issued by identity-service. */
@ApplicationScoped
public class JwtAuthenticationService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() { };

    @Inject ObjectMapper objectMapper;

    @ConfigProperty(name = "app.security.jwt-signing-secret")
    String signingSecret;

    @ConfigProperty(name = "app.security.jwt.issuer")
    String issuer;

    @ConfigProperty(name = "app.security.jwt.audience")
    String audience;

    public AuthenticatedUser verify(String token) {
        if (token == null || token.isBlank()) {
            throw new AuthenticationException("INVALID_TOKEN", "El token de acceso esta vacio.");
        }

        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new AuthenticationException("INVALID_TOKEN", "El formato del token de acceso no es valido.");
        }

        Map<String, Object> header = decodeJson(parts[0]);
        if (!"HS256".equals(header.get("alg")) || !"JWT".equals(header.get("typ"))) {
            throw new AuthenticationException("INVALID_TOKEN", "El algoritmo del token no es valido.");
        }

        String signingInput = parts[0] + "." + parts[1];
        String expectedSignature = sign(signingInput);
        if (!MessageDigest.isEqual(
                expectedSignature.getBytes(StandardCharsets.US_ASCII),
                parts[2].getBytes(StandardCharsets.US_ASCII))) {
            throw new AuthenticationException("INVALID_TOKEN", "La firma del token no es valida.");
        }

        Map<String, Object> claims = decodeJson(parts[1]);
        assertClaimEquals(claims, "iss", issuer);
        assertClaimEquals(claims, "aud", audience);
        long expiresAt = numberClaim(claims, "exp");
        if (expiresAt <= Instant.now().getEpochSecond()) {
            throw new AuthenticationException("TOKEN_EXPIRED", "El token de acceso ha expirado.");
        }

        String subject = requiredString(claims, "sub");
        String login = requiredString(claims, "login");
        return new AuthenticatedUser(
                subject,
                login,
                optionalString(claims, "email"),
                optionalString(claims, "name"),
                stringList(claims.get("roles")),
                stringList(claims.get("permissions")));
    }

    private void assertClaimEquals(Map<String, Object> claims, String name, String expected) {
        if (!expected.equals(claims.get(name))) {
            throw new AuthenticationException("INVALID_TOKEN", "El claim " + name + " no es valido.");
        }
    }

    private long numberClaim(Map<String, Object> claims, String name) {
        Object value = claims.get(name);
        if (value instanceof Number number) {
            return number.longValue();
        }
        throw new AuthenticationException("INVALID_TOKEN", "El claim " + name + " es obligatorio.");
    }

    private String requiredString(Map<String, Object> claims, String name) {
        String value = optionalString(claims, name);
        if (value == null || value.isBlank()) {
            throw new AuthenticationException("INVALID_TOKEN", "El claim " + name + " es obligatorio.");
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

    private Map<String, Object> decodeJson(String encoded) {
        try {
            return objectMapper.readValue(Base64.getUrlDecoder().decode(encoded), MAP_TYPE);
        } catch (Exception error) {
            throw new AuthenticationException("INVALID_TOKEN", "El contenido del token no es valido.");
        }
    }

    private String sign(String signingInput) {
        byte[] secret = signingSecret.getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException("El secreto JWT debe tener al menos 32 bytes.");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(signingInput.getBytes(StandardCharsets.US_ASCII)));
        } catch (Exception error) {
            throw new IllegalStateException("No se pudo verificar la firma JWT.", error);
        }
    }

    public static final class AuthenticationException extends RuntimeException {
        private final String code;

        public AuthenticationException(String code, String message) {
            super(message);
            this.code = code;
        }

        public String code() {
            return code;
        }
    }
}
