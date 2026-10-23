package ec.gob.iess.calculos;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

final class TestJwtToken {

    private static final String SECRET = "test-jwt-signing-secret-change-me-32-bytes";

    private TestJwtToken() {
    }

    static String issue(String login, String... permissions) {
        String header = encode("{\"typ\":\"JWT\",\"alg\":\"HS256\"}");
        String permissionJson = java.util.Arrays.stream(permissions)
                .map(permission -> "\"" + permission + "\"")
                .collect(java.util.stream.Collectors.joining(","));
        long now = Instant.now().getEpochSecond();
        String payload = encode("{"
                + "\"iss\":\"identity-service\","
                + "\"aud\":\"venta-pasajes\","
                + "\"sub\":\"" + UUID.randomUUID() + "\","
                + "\"sid\":\"" + UUID.randomUUID() + "\","
                + "\"login\":\"" + login + "\","
                + "\"roles\":[],"
                + "\"permissions\":[" + permissionJson + "],"
                + "\"iat\":" + now + ","
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
