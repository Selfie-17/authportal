package com.selva.authportal.email;

import lombok.Data;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Encapsulates Gmail SMTP configuration properties and status checks.
 * Reads environment variables:
 * MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_SMTP_AUTH,
 * MAIL_SMTP_STARTTLS_ENABLE, MAIL_SMTP_STARTTLS_REQUIRED, MAIL_SENDER_NAME.
 */
@Data
@Component
public class EmailProperties {

    @Value("${spring.mail.host:smtp.gmail.com}")
    private String host;

    @Value("${spring.mail.port:587}")
    private int port;

    @Value("${spring.mail.username:}")
    private String username;

    @Value("${spring.mail.password:}")
    private String password;

    @Value("${spring.mail.properties.mail.smtp.auth:true}")
    private boolean auth;

    @Value("${spring.mail.properties.mail.smtp.starttls.enable:true}")
    private boolean starttlsEnable;

    @Value("${spring.mail.properties.mail.smtp.starttls.required:true}")
    private boolean starttlsRequired;

    @Value("${app.mail.sender-name:RGUKT Academic Portal}")
    private String senderName;

    @Value("${app.mail.sender-email:}")
    private String senderEmail;

    /**
     * Checks if Gmail SMTP credentials are configured.
     * Requires non-empty username and non-empty password that is not a placeholder.
     */
    public boolean isConfigured() {
        if (username == null || username.trim().isEmpty() || username.contains("your-email") || username.contains("your_email")) {
            return false;
        }
        if (password == null || password.trim().isEmpty() || password.contains("your-gmail") || password.contains("your_gmail") || password.contains("your_app_password")) {
            return false;
        }
        return true;
    }

    /**
     * Returns the effective sender email address.
     */
    public String getEffectiveSenderEmail() {
        if (senderEmail != null && !senderEmail.trim().isEmpty() && !senderEmail.contains("your-")) {
            return senderEmail.trim();
        }
        if (username != null && !username.trim().isEmpty() && !username.contains("your-")) {
            return username.trim();
        }
        return "no-reply@rguktn.ac.in";
    }
}
