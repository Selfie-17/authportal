package com.selva.authportal.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Thread-safe, lightweight, in-memory login rate limiter and brute-force protector.
 * Restricts repetitive failed authentication attempts per IP address or email
 * to protect against credential stuffing attacks on low-resource environments.
 */
@Slf4j
@Service
public class LoginRateLimiter {

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCKOUT_DURATION_MILLIS = 15 * 60 * 1000; // 15 minutes

    private record AttemptRecord(int count, long lastAttemptTime) {
        boolean isLocked() {
            return count >= MAX_ATTEMPTS && (System.currentTimeMillis() - lastAttemptTime < LOCKOUT_DURATION_MILLIS);
        }

        boolean isExpired() {
            return System.currentTimeMillis() - lastAttemptTime > LOCKOUT_DURATION_MILLIS;
        }
    }

    private final Map<String, AttemptRecord> attempts = new ConcurrentHashMap<>();

    /**
     * Checks whether an identifier (e.g. client IP or email) is temporarily locked out.
     */
    public boolean isBlocked(String key) {
        if (key == null || key.isBlank()) {
            return false;
        }
        String normalizedKey = key.trim().toLowerCase();
        AttemptRecord record = attempts.get(normalizedKey);
        if (record == null) {
            return false;
        }
        if (record.isExpired()) {
            attempts.remove(normalizedKey);
            return false;
        }
        return record.isLocked();
    }

    /**
     * Records a failed login attempt for the given identifier.
     */
    public void recordFailure(String key) {
        if (key == null || key.isBlank()) {
            return;
        }
        String normalizedKey = key.trim().toLowerCase();
        attempts.compute(normalizedKey, (k, existing) -> {
            long now = System.currentTimeMillis();
            if (existing == null || existing.isExpired()) {
                return new AttemptRecord(1, now);
            }
            int newCount = existing.count() + 1;
            if (newCount >= MAX_ATTEMPTS) {
                log.warn("Rate limit triggered: Identifier '{}' exceeded {} failed attempts. Locked for 15 minutes.",
                        normalizedKey, MAX_ATTEMPTS);
            }
            return new AttemptRecord(newCount, now);
        });
        cleanExpiredIfNecessary();
    }

    /**
     * Resets failed attempts upon a successful login.
     */
    public void recordSuccess(String key) {
        if (key != null && !key.isBlank()) {
            attempts.remove(key.trim().toLowerCase());
        }
    }

    /**
     * Clears all tracking records.
     */
    public void reset() {
        attempts.clear();
    }

    private void cleanExpiredIfNecessary() {
        if (attempts.size() > 500) {
            attempts.entrySet().removeIf(e -> e.getValue().isExpired());
        }
    }
}
