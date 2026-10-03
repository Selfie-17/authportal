package com.selva.authportal.email;

import java.util.List;

/**
 * Service interface for transactional and report emails.
 */
public interface EmailService {

    /**
     * Checks if Gmail SMTP credentials are configured.
     */
    boolean isConfigured();

    /**
     * Gets the configured sender email.
     */
    String getSenderEmail();

    /**
     * Gets the institutional display sender name.
     */
    String getSenderName();

    /**
     * Gets the SMTP host (e.g. smtp.gmail.com).
     */
    String getHost();

    /**
     * Gets the SMTP port (e.g. 587).
     */
    int getPort();

    /**
     * Gets the active transport mechanism ("GMAIL_REST_API" for HTTPS Port 443, or "GMAIL_SMTP" for Port 587).
     */
    default String getTransport() {
        return "GMAIL_SMTP";
    }

    /**
     * Sends a plain-text email.
     */
    EmailSendResult sendEmail(String to, String subject, String body);

    /**
     * Sends an HTML email.
     */
    EmailSendResult sendHtmlEmail(String to, String subject, String htmlBody);

    /**
     * Sends an HTML email with attachments.
     */
    EmailSendResult sendEmailWithAttachments(String to, String subject, String htmlBody, List<EmailAttachment> attachments);

    /**
     * Sends an email based on an EmailSendRequest.
     */
    EmailSendResult sendEmail(EmailSendRequest request);

    /**
     * Sends a batch of emails.
     */
    List<EmailSendResult> sendBatch(List<EmailSendRequest> requests);
}
