package com.selva.authportal.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lightweight, in-memory UserDetails cache designed for low-memory containers.
 * Prevents repetitive database queries on every authenticated API request while
 * maintaining strict security guarantees through immediate programmatic invalidation
 * on role/status changes and a short 2-minute default TTL.
 */
@Slf4j
@Service
public class UserCacheService {

    private static final long CACHE_TTL_MILLIS = 120_000; // 2 minutes

    private record CacheEntry(UserDetails userDetails, long expiresAt) {
        boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }
    }

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    /**
     * Retrieves cached UserDetails if present and not expired.
     */
    public UserDetails get(String email) {
        if (email == null) {
            return null;
        }
        String key = email.trim().toLowerCase();
        CacheEntry entry = cache.get(key);
        if (entry == null) {
            return null;
        }
        if (entry.isExpired()) {
            cache.remove(key);
            return null;
        }
        return entry.userDetails();
    }

    /**
     * Stores UserDetails in cache with short TTL.
     */
    public void put(String email, UserDetails userDetails) {
        if (email == null || userDetails == null) {
            return;
        }
        String key = email.trim().toLowerCase();
        long expiresAt = System.currentTimeMillis() + CACHE_TTL_MILLIS;
        cache.put(key, new CacheEntry(userDetails, expiresAt));
        cleanExpiredIfNecessary();
    }

    /**
     * Immediately evicts a user from cache when credentials, roles, or status change.
     */
    public void evict(String email) {
        if (email != null) {
            String key = email.trim().toLowerCase();
            cache.remove(key);
            log.debug("Evicted cached UserDetails for {}", key);
        }
    }

    /**
     * Clears all cached user entries.
     */
    public void clear() {
        cache.clear();
    }

    private void cleanExpiredIfNecessary() {
        if (cache.size() > 500) {
            cache.entrySet().removeIf(e -> e.getValue().isExpired());
        }
    }
}
