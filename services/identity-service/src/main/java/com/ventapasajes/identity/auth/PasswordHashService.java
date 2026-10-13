package com.ventapasajes.identity.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Base64;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.ventapasajes.identity.api.ApiException;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class PasswordHashService {

    private static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int SALT_BYTES = 16;
    private static final int KEY_BITS = 256;

    private final SecureRandom secureRandom = new SecureRandom();

    @ConfigProperty(name = "app.security.password-pepper", defaultValue = "")
    String pepper;

    @ConfigProperty(name = "app.auth.password.pbkdf2.iterations", defaultValue = "210000")
    int iterations;

    public String hash(String password) {
        validatePassword(password);
        byte[] salt = new byte[SALT_BYTES];
        secureRandom.nextBytes(salt);
        byte[] hash = derive(password, salt, iterations);
        return ALGORITHM + "$" + iterations + "$" + encode(salt) + "$" + encode(hash);
    }

    public boolean verify(String password, String storedHash) {
        if (password == null || storedHash == null || storedHash.isBlank()) {
            return false;
        }
        String[] parts = storedHash.split("\\$");
        if (parts.length != 4 || !ALGORITHM.equals(parts[0])) {
            return false;
        }
        try {
            int storedIterations = Integer.parseInt(parts[1]);
            byte[] salt = decode(parts[2]);
            byte[] expected = decode(parts[3]);
            byte[] actual = derive(password, salt, storedIterations);
            return MessageDigest.isEqual(expected, actual);
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 12) {
            throw ApiException.validation("WEAK_PASSWORD", "Password must contain at least 12 characters.");
        }
    }

    private byte[] derive(String password, byte[] salt, int iterationCount) {
        try {
            char[] chars = (password + pepper).toCharArray();
            KeySpec spec = new PBEKeySpec(chars, salt, iterationCount, KEY_BITS);
            return SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).getEncoded();
        } catch (Exception exception) {
            throw new IllegalStateException("Password hashing failed.", exception);
        }
    }

    private String encode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private byte[] decode(String value) {
        return Base64.getUrlDecoder().decode(value.getBytes(StandardCharsets.US_ASCII));
    }
}
