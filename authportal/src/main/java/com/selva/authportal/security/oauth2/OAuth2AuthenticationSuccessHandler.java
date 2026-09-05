package com.selva.authportal.security.oauth2;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

/**
 * OAuth2 success handler that initiates a secure one-time code exchange.
 * Ensures the authenticated user is persisted in the database and generates
 * a short-lived, single-use exchange code for the frontend callback.
 * Note: Does NOT pass JWT in the redirect URL.
 */
@Slf4j
@Component
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final String frontendUrl;
    private final OAuth2ExchangeCodeStore exchangeCodeStore;
    private final CustomOAuth2UserService customOAuth2UserService;

    public OAuth2AuthenticationSuccessHandler(
            @Value("${app.cors.allowed-origins:http://localhost:5173}") String frontendUrl,
            OAuth2ExchangeCodeStore exchangeCodeStore,
            CustomOAuth2UserService customOAuth2UserService
    ) {
        this.frontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
        this.exchangeCodeStore = exchangeCodeStore;
        this.customOAuth2UserService = customOAuth2UserService;
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException {
        String email;
        Object principal = authentication.getPrincipal();

        try {
            if (principal instanceof OAuth2UserPrincipal customPrincipal) {
                email = customPrincipal.getUser().getEmail();
            } else if (principal instanceof OAuth2User oAuth2User) {
                // Ensure user is provisioned or linked in database
                OAuth2User processed = customOAuth2UserService.processOAuth2User(oAuth2User);
                email = processed.getName();
            } else {
                email = authentication.getName();
            }
        } catch (Exception ex) {
            log.error("Failed to process authenticated OAuth2 user: {}", ex.getMessage());
            String targetUrl = UriComponentsBuilder.fromUriString(frontendUrl + "/login")
                    .queryParam("error", "oauth_failed")
                    .queryParam("message", ex.getMessage())
                    .build()
                    .toUriString();
            clearAuthenticationAttributes(request);
            getRedirectStrategy().sendRedirect(request, response, targetUrl);
            return;
        }

        // Generate short-lived, single-use exchange code
        String exchangeCode = exchangeCodeStore.createCode(email);
        log.info("Issued single-use OAuth2 exchange code for user: {}", email);

        // Redirect to React frontend callback without exposing JWT
        String targetUrl = UriComponentsBuilder.fromUriString(frontendUrl + "/oauth2/callback")
                .queryParam("code", exchangeCode)
                .build()
                .toUriString();

        clearAuthenticationAttributes(request);
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}
