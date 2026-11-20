package com.selva.authportal.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LoginRateLimiterTest {

    private LoginRateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        rateLimiter = new LoginRateLimiter();
    }

    @Test
    @DisplayName("Should not be blocked initially")
    void testInitialNotBlocked() {
        assertThat(rateLimiter.isBlocked("test@rguktn.ac.in")).isFalse();
    }

    @Test
    @DisplayName("Should block identifier after 5 failed attempts")
    void testBlockAfterFiveFailures() {
        String key = "attacker@rguktn.ac.in";
        for (int i = 0; i < 4; i++) {
            rateLimiter.recordFailure(key);
            assertThat(rateLimiter.isBlocked(key)).isFalse();
        }

        // 5th failure triggers lockout
        rateLimiter.recordFailure(key);
        assertThat(rateLimiter.isBlocked(key)).isTrue();
    }

    @Test
    @DisplayName("Should clear lockout and count upon recordSuccess")
    void testRecordSuccessClearsBlock() {
        String key = "user@rguktn.ac.in";
        for (int i = 0; i < 5; i++) {
            rateLimiter.recordFailure(key);
        }
        assertThat(rateLimiter.isBlocked(key)).isTrue();

        rateLimiter.recordSuccess(key);
        assertThat(rateLimiter.isBlocked(key)).isFalse();
    }

    @Test
    @DisplayName("Should handle null and empty keys gracefully")
    void testNullKeyHandling() {
        assertThat(rateLimiter.isBlocked(null)).isFalse();
        assertThat(rateLimiter.isBlocked("")).isFalse();
        rateLimiter.recordFailure(null);
        rateLimiter.recordSuccess(null);
    }
}
