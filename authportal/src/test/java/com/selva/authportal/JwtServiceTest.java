package com.selva.authportal;

import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import com.selva.authportal.security.CustomUserDetails;
import com.selva.authportal.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private static final String TEST_SECRET = "54686973497341546573745365637265744B6579466F72556E697454657374696E67507572706F7365734F6E6C793132";
    private static final long EXPIRATION_MS = 3600000; // 1 hour

    private JwtService jwtService;
    private User testUser;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(TEST_SECRET, EXPIRATION_MS);

        testUser = User.builder()
                .id(42L)
                .name("Selva")
                .email("n210921@rguktn.ac.in")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();
    }

    @Test
    @DisplayName("Should generate valid token containing correct claims")
    void testGenerateTokenAndExtractClaims() {
        String token = jwtService.generateToken(testUser);

        assertNotNull(token);
        assertFalse(token.isEmpty());

        assertEquals("n210921@rguktn.ac.in", jwtService.extractEmail(token));
        assertEquals("STUDENT", jwtService.extractRole(token));
        assertEquals(42L, jwtService.extractUserId(token));
        assertTrue(jwtService.validateToken(token));
    }

    @Test
    @DisplayName("Should validate token against matching UserDetails")
    void testValidateTokenWithUserDetails() {
        String token = jwtService.generateToken(testUser);
        CustomUserDetails userDetails = new CustomUserDetails(testUser);

        assertTrue(jwtService.isTokenValid(token, userDetails));
    }

    @Test
    @DisplayName("Should reject token when UserDetails has different email")
    void testRejectTokenForDifferentUser() {
        String token = jwtService.generateToken(testUser);

        User anotherUser = User.builder()
                .id(99L)
                .name("Other")
                .email("n220001@rguktn.ac.in")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();

        CustomUserDetails anotherDetails = new CustomUserDetails(anotherUser);

        assertFalse(jwtService.isTokenValid(token, anotherDetails));
    }

    @Test
    @DisplayName("Should recognize expired token")
    void testExpiredToken() {
        // Generate token with negative expiration (already expired)
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", 42L);
        claims.put("role", "STUDENT");

        String expiredToken = jwtService.buildToken(claims, "n210921@rguktn.ac.in", -1000);

        assertTrue(jwtService.isTokenExpired(expiredToken));
        assertFalse(jwtService.validateToken(expiredToken));
    }

    @Test
    @DisplayName("Should reject tampered token with altered signature")
    void testTamperedToken() {
        String token = jwtService.generateToken(testUser);
        String tamperedToken = token.substring(0, token.length() - 4) + "XXXX";

        assertFalse(jwtService.validateToken(tamperedToken));
    }

    @Test
    @DisplayName("Should reject malformed or null token")
    void testMalformedToken() {
        assertFalse(jwtService.validateToken("not.a.valid.jwt.token"));
        assertFalse(jwtService.validateToken(""));
        assertFalse(jwtService.validateToken(null));
    }
}
