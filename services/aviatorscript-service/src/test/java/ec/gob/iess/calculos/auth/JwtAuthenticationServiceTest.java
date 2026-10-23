package ec.gob.iess.calculos.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JwtAuthenticationServiceTest {

    private static final String SECRET = "test-jwt-signing-secret-change-me-32-bytes";
    private JwtAuthenticationService service;

    @BeforeEach
    void setUp() {
        service = new JwtAuthenticationService();
        service.objectMapper = new ObjectMapper();
        service.signingSecret = SECRET;
        service.issuer = "identity-service";
        service.audience = "venta-pasajes";
    }

    @Test
    void extraeLaIdentidadYLosPermisosDelTokenFirmado() {
        AuthenticatedUser user = service.verify(token("formula.editor", "aviatorscript.formulas.read"));

        assertEquals("formula.editor", user.login());
        assertEquals(true, user.hasPermission("aviatorscript.formulas.read"));
        assertEquals(false, user.hasPermission("aviatorscript.formulas.activate"));
    }

    @Test
    void rechazaUnTokenConFirmaAlterada() {
        String valid = token("formula.editor", "aviatorscript.formulas.read");

        assertThrows(JwtAuthenticationService.AuthenticationException.class,
                () -> service.verify(valid.substring(0, valid.length() - 1) + "x"));
    }

    private static String token(String login, String... permissions) {
        String header = encode("{\"typ\":\"JWT\",\"alg\":\"HS256\"}");
        String permissionJson = java.util.Arrays.stream(permissions)
                .map(permission -> "\"" + permission + "\"")
                .collect(java.util.stream.Collectors.joining(","));
        long now = Instant.now().getEpochSecond();
        String payload = encode("{"
                + "\"iss\":\"identity-service\","
                + "\"aud\":\"venta-pasajes\","
                + "\"sub\":\"" + UUID.randomUUID() + "\","
                + "\"login\":\"" + login + "\","
                + "\"permissions\":[" + permissionJson + "],"
                + "\"exp\":" + (now + 3600)
                + "}");
        String signingInput = header + "." + payload;
        return signingInput + "." + sign(signingInput);
    }

    private static String encode(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String sign(String signingInput) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(signingInput.getBytes(StandardCharsets.US_ASCII)));
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }
}
