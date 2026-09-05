package com.selva.authportal.controller;

import com.selva.authportal.dto.*;
import com.selva.authportal.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * Controller handling public authentication endpoints and authenticated user self-queries.
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * Public registration endpoint.
     * System determines role server-side; client role parameters are strictly disallowed.
     */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Public login endpoint for email/password authentication.
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Secure one-time code exchange endpoint for OAuth2 flow.
     * Exchanging the temporary authorization code issues an application JWT in the response body.
     */
    @PostMapping("/oauth2/exchange")
    public ResponseEntity<AuthResponse> exchangeOAuthCode(@Valid @RequestBody OAuth2ExchangeRequest request) {
        AuthResponse response = authService.exchangeOAuthCode(request.getCode());
        return ResponseEntity.ok(response);
    }

    /**
     * Returns the currently authenticated user's profile.
     */
    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(@AuthenticationPrincipal UserDetails userDetails) {
        UserResponse response = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(response);
    }

    /**
     * Stateless logout endpoint.
     * Client removes its stored JWT.
     */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse> logout() {
        return ResponseEntity.ok(ApiResponse.builder()
                .success(true)
                .message("Logged out successfully.")
                .build());
    }
}
