package com.selva.authportal.email;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.selva.authportal.model.EmailAutomationConfig;
import com.selva.authportal.repository.EmailAutomationConfigRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

/**
 * Service that integrates directly with Google's Gmail REST API (v1) over HTTPS (Port 443).
 *
 * Why this is crucial:
 * Cloud platforms like Render explicitly block outbound traffic on SMTP ports 25, 465, and 587
 * on their Free Tier. Communicating over standard HTTPS (Port 443) completely bypasses Render's
 * firewall blocks and allows reliable, instantaneous email delivery directly from the user's
 * institutional/admin Gmail account.
 */
@Slf4j
@Service
public class GmailRestApiService {

    private static final String GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    private static final String GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
    private static final String GMAIL_AUTH_SCOPE = "https://www.googleapis.com/auth/gmail.send";

    private final String clientId;
    private final String clientSecret;
    private final String envRefreshToken;
    private final EmailAutomationConfigRepository automationConfigRepository;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    // In-memory token cache
    private volatile String cachedAccessToken;
    private volatile Instant tokenExpiresAt = Instant.EPOCH;

    public GmailRestApiService(
            @Value("${spring.security.oauth2.client.registration.google.client-id:${GOOGLE_CLIENT_ID:}}") String clientId,
            @Value("${spring.security.oauth2.client.registration.google.client-secret:${GOOGLE_CLIENT_SECRET:}}") String clientSecret,
            @Value("${app.mail.gmail.refresh-token:${GMAIL_REFRESH_TOKEN:}}") String envRefreshToken,
            EmailAutomationConfigRepository automationConfigRepository
    ) {
        this.clientId = (clientId != null) ? clientId.trim() : "";
        this.clientSecret = (clientSecret != null) ? clientSecret.trim() : "";
        this.envRefreshToken = (envRefreshToken != null) ? envRefreshToken.trim() : "";
        this.automationConfigRepository = automationConfigRepository;
        this.restClient = RestClient.builder().build();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Checks if Gmail REST API is ready to dispatch emails over HTTPS (Port 443).
     */
    public boolean isConfigured() {
        if (clientId.isBlank() || clientSecret.isBlank()) {
            return false;
        }
        String refreshToken = getEffectiveRefreshToken();
        return refreshToken != null && !refreshToken.isBlank();
    }

    /**
     * Retrieves the active refresh token either from environment variables (Render/Docker)
     * or persisted in the database via the OAuth connection flow.
     */
    public String getEffectiveRefreshToken() {
        if (!envRefreshToken.isBlank() && !envRefreshToken.contains("your_refresh_token")) {
            return envRefreshToken;
        }
        try {
            return automationConfigRepository.findAll().stream()
                    .findFirst()
                    .map(EmailAutomationConfig::getGmailRefreshToken)
                    .filter(t -> t != null && !t.isBlank())
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Could not retrieve persisted Gmail refresh token from database: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Returns the connected Gmail address if known.
     */
    public String getConnectedEmail() {
        try {
            return automationConfigRepository.findAll().stream()
                    .findFirst()
                    .map(EmailAutomationConfig::getGmailConnectedEmail)
                    .filter(e -> e != null && !e.isBlank())
                    .orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Dispatches a Jakarta Mail MimeMessage via Gmail REST API over HTTPS (Port 443).
     *
     * @param mimeMessage The fully constructed MIME message including all attachments and HTML body.
     * @return Google Gmail API message ID.
     */
    public String sendMimeMessage(MimeMessage mimeMessage) throws Exception {
        String accessToken = getValidAccessToken();

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        mimeMessage.writeTo(buffer);
        byte[] rawBytes = buffer.toByteArray();

        // Encode as URL-safe Base64 without padding as required by Gmail API
        String encodedRaw = Base64.getUrlEncoder().withoutPadding().encodeToString(rawBytes);

        String jsonPayload = objectMapper.writeValueAsString(Map.of("raw", encodedRaw));

        log.debug("Sending message via Gmail REST API (POST {})", GMAIL_SEND_URL);

        String responseBody = restClient.post()
                .uri(GMAIL_SEND_URL)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(jsonPayload)
                .retrieve()
                .body(String.class);

        JsonNode responseNode = objectMapper.readTree(responseBody);
        String messageId = responseNode.path("id").asText();
        log.info("Gmail REST API dispatch succeeded. Google Message-ID: {}", messageId);
        return messageId;
    }

    /**
     * Returns a valid Google OAuth2 access token, automatically refreshing it if expired.
     */
    public synchronized String getValidAccessToken() {
        if (cachedAccessToken != null && Instant.now().isBefore(tokenExpiresAt)) {
            return cachedAccessToken;
        }

        String refreshToken = getEffectiveRefreshToken();
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new IllegalStateException("Gmail REST API cannot send email: No refresh token configured. " +
                    "Set GMAIL_REFRESH_TOKEN environment variable or connect via Google OAuth.");
        }

        log.info("Refreshing Google OAuth2 access token for Gmail API over HTTPS...");

        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
        formData.add("client_id", clientId);
        formData.add("client_secret", clientSecret);
        formData.add("refresh_token", refreshToken);
        formData.add("grant_type", "refresh_token");

        try {
            String response = restClient.post()
                    .uri(GOOGLE_TOKEN_URL)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(formData)
                    .retrieve()
                    .body(String.class);

            JsonNode node = objectMapper.readTree(response);
            if (!node.has("access_token")) {
                throw new RuntimeException("Google token endpoint response missing access_token: " + response);
            }

            this.cachedAccessToken = node.get("access_token").asText();
            long expiresIn = node.has("expires_in") ? node.get("expires_in").asLong() : 3600L;
            this.tokenExpiresAt = Instant.now().plusSeconds(Math.max(60L, expiresIn - 120L));
            log.info("Google OAuth2 access token refreshed successfully (expires in {}s).", expiresIn);
            return this.cachedAccessToken;

        } catch (Exception e) {
            log.error("Failed to refresh Google OAuth2 access token: {}", e.getMessage());
            throw new RuntimeException("Failed to refresh Gmail API OAuth access token: " + e.getMessage(), e);
        }
    }

    /**
     * Builds the Google OAuth2 consent URL for authorizing Gmail sending scope.
     */
    public String buildAuthorizationUrl(String redirectUri) {
        if (clientId.isBlank()) {
            throw new IllegalStateException("Google Client ID is not configured (GOOGLE_CLIENT_ID)");
        }
        return "https://accounts.google.com/o/oauth2/v2/auth?" +
                "client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8) +
                "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8) +
                "&response_type=code" +
                "&scope=" + URLEncoder.encode(GMAIL_AUTH_SCOPE + " email profile", StandardCharsets.UTF_8) +
                "&access_type=offline" +
                "&prompt=consent";
    }

    /**
     * Exchanges an authorization code for refresh & access tokens and persists the refresh token.
     */
    public synchronized Map<String, Object> exchangeAuthorizationCode(String code, String redirectUri, String adminEmail) {
        log.info("Exchanging Google authorization code for Gmail API refresh token...");

        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
        formData.add("client_id", clientId);
        formData.add("client_secret", clientSecret);
        formData.add("code", code);
        formData.add("grant_type", "authorization_code");
        formData.add("redirect_uri", redirectUri);

        try {
            String response = restClient.post()
                    .uri(GOOGLE_TOKEN_URL)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(formData)
                    .retrieve()
                    .body(String.class);

            JsonNode node = objectMapper.readTree(response);
            String newAccessToken = node.path("access_token").asText();
            String newRefreshToken = node.path("refresh_token").asText();

            if (newRefreshToken == null || newRefreshToken.isBlank()) {
                log.warn("Google did not return a new refresh token (already authorized?). Using existing if available.");
            }

            // Fetch email address of the authenticated Gmail account
            String emailAddress = adminEmail;
            try {
                String profileJson = restClient.get()
                        .uri(GMAIL_PROFILE_URL)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + newAccessToken)
                        .retrieve()
                        .body(String.class);
                JsonNode profileNode = objectMapper.readTree(profileJson);
                if (profileNode.has("emailAddress")) {
                    emailAddress = profileNode.get("emailAddress").asText();
                }
            } catch (Exception e) {
                log.debug("Could not query Gmail user profile: {}", e.getMessage());
            }

            // Persist in EmailAutomationConfig
            EmailAutomationConfig config = automationConfigRepository.findAll().stream()
                    .findFirst()
                    .orElseGet(() -> EmailAutomationConfig.builder().build());

            if (newRefreshToken != null && !newRefreshToken.isBlank()) {
                config.setGmailRefreshToken(newRefreshToken);
            }
            config.setGmailConnectedEmail(emailAddress);
            config.setUpdatedBy(adminEmail != null ? adminEmail : "admin");
            automationConfigRepository.save(config);

            this.cachedAccessToken = newAccessToken;
            long expiresIn = node.has("expires_in") ? node.get("expires_in").asLong() : 3600L;
            this.tokenExpiresAt = Instant.now().plusSeconds(Math.max(60L, expiresIn - 120L));

            log.info("Gmail REST API successfully authorized for email: {}", emailAddress);

            return Map.of(
                    "success", true,
                    "connectedEmail", emailAddress,
                    "message", "Gmail REST API successfully authorized over HTTPS (Port 443). Render Free Tier compatible!"
            );

        } catch (Exception e) {
            log.error("Failed to exchange Google authorization code: {}", e.getMessage());
            throw new RuntimeException("Failed to complete Gmail authorization: " + e.getMessage(), e);
        }
    }
}
