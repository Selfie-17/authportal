package com.selva.authportal.security.oauth2;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory thread-safe store for short-lived, single-use authorization exchange codes.
 * Prevents exposing JWT tokens directly in frontend redirect URLs.
 */
@Component
public class OAuth2ExchangeCodeStore {

    private static final long CODE_VALIDITY_SECONDS = 60; // 1 minute TTL

    public record CodePayload(String email, Instant expiresAt) {
        public boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }

    private final Map<String, CodePayload> store = new ConcurrentHashMap<>();

    /**
     * Creates a new one-time exchange code for the given user email.
     *
     * @param email The authenticated user's email
     * @return Single-use code string
     */
    public String createCode(String email) {
        cleanupExpiredCodes();
        String code = UUID.randomUUID().toString().replace("-", "");
        Instant expiresAt = Instant.now().plusSeconds(CODE_VALIDITY_SECONDS);
        store.put(code, new CodePayload(email, expiresAt));
        return code;
    }

    /**
     * Consumes and burns a one-time exchange code.
     * Once retrieved, the code is immediately invalidated.
     *
     * @param code The single-use exchange code
     * @return Optional containing the authenticated email if valid and unexpired
     */
    public Optional<String> consumeCode(String code) {
        if (code == null || code.trim().isEmpty()) {
            return Optional.empty();
        }

        CodePayload payload = store.remove(code.trim());
        if (payload == null || payload.isExpired()) {
            return Optional.empty();
        }

        return Optional.of(payload.email());
    }

    private void cleanupExpiredCodes() {
        store.entrySet().removeIf(entry -> entry.getValue().isExpired());
    }
}
