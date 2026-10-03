package com.selva.authportal.email;

import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service implementing email dispatch exclusively via Gmail SMTP (smtp.gmail.com:587)
 * using Spring Boot Mail and Jakarta Mail.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GmailEmailService implements EmailService {

    private final JavaMailSender mailSender;
    private final EmailProperties emailProperties;

    @Override
    public boolean isConfigured() {
        return emailProperties.isConfigured();
    }

    @Override
    public String getSenderEmail() {
        return emailProperties.getEffectiveSenderEmail();
    }

    @Override
    public String getSenderName() {
        return emailProperties.getSenderName();
    }

    @Override
    public String getHost() {
        return emailProperties.getHost();
    }

    @Override
    public int getPort() {
        return emailProperties.getPort();
    }

    @Override
    public EmailSendResult sendEmail(String to, String subject, String body) {
        EmailSendRequest request = EmailSendRequest.builder()
                .to(to)
                .subject(subject)
                .body(body)
                .html(false)
                .build();
        return sendEmail(request);
    }

    @Override
    public EmailSendResult sendHtmlEmail(String to, String subject, String htmlBody) {
        EmailSendRequest request = EmailSendRequest.builder()
                .to(to)
                .subject(subject)
                .body(htmlBody)
                .html(true)
                .build();
        return sendEmail(request);
    }

    @Override
    public EmailSendResult sendEmailWithAttachments(
            String to,
            String subject,
            String htmlBody,
            List<EmailAttachment> attachments
    ) {
        EmailSendRequest request = EmailSendRequest.builder()
                .to(to)
                .subject(subject)
                .body(htmlBody)
                .html(true)
                .attachments(attachments != null ? attachments : new ArrayList<>())
                .build();
        return sendEmail(request);
    }

    @Override
    public EmailSendResult sendEmail(EmailSendRequest request) {
        if (!isConfigured()) {
            throw new IllegalStateException(
                    "Gmail SMTP credentials are not configured. Please supply MAIL_USERNAME and MAIL_PASSWORD in your .env file."
            );
        }

        if (request.getTo() == null || request.getTo().trim().isEmpty()) {
            throw new IllegalArgumentException("Recipient email address cannot be empty.");
        }

        String targetEmail = request.getTo().trim();
        String subject = (request.getSubject() != null && !request.getSubject().trim().isEmpty())
                ? request.getSubject().trim()
                : "(No Subject)";
        String body = request.getBody() != null ? request.getBody() : "";

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            boolean hasAttachments = request.getAttachments() != null && !request.getAttachments().isEmpty();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, hasAttachments, StandardCharsets.UTF_8.name());

            String senderEmail = emailProperties.getEffectiveSenderEmail();
            String senderName = emailProperties.getSenderName();
            helper.setFrom(new InternetAddress(senderEmail, senderName, StandardCharsets.UTF_8.name()));
            helper.setTo(targetEmail);
            helper.setSubject(subject);

            // Set email body (HTML or plain text)
            helper.setText(body, request.isHtml());

            List<String> attachedFiles = new ArrayList<>();
            if (hasAttachments) {
                for (EmailAttachment attachment : request.getAttachments()) {
                    if (attachment == null || attachment.getName() == null || attachment.getName().isBlank()) {
                        continue;
                    }
                    byte[] bytes = attachment.getBytes();
                    if (bytes == null || bytes.length == 0) {
                        continue;
                    }

                    String contentType = attachment.getContentType();
                    if (contentType == null || contentType.isBlank()) {
                        String lowerName = attachment.getName().toLowerCase();
                        if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
                            contentType = "text/html; charset=UTF-8";
                        } else if (lowerName.endsWith(".json")) {
                            contentType = "application/json; charset=UTF-8";
                        } else if (lowerName.endsWith(".pdf")) {
                            contentType = "application/pdf";
                        } else if (lowerName.endsWith(".txt")) {
                            contentType = "text/plain; charset=UTF-8";
                        } else {
                            contentType = "application/octet-stream";
                        }
                    }

                    ByteArrayResource resource = new ByteArrayResource(bytes);
                    helper.addAttachment(attachment.getName(), resource, contentType);
                    attachedFiles.add(attachment.getName());
                }
            }

            log.info("Dispatching email via Gmail SMTP to '{}' with subject '{}' and {} attachments...",
                    targetEmail, subject, attachedFiles.size());

            mailSender.send(mimeMessage);

            String messageId = mimeMessage.getMessageID();
            if (messageId == null || messageId.isBlank()) {
                messageId = "<gmail-" + UUID.randomUUID() + "@smtp.gmail.com>";
            }

            log.info("Email successfully sent via Gmail SMTP to {}. Message-ID: {}", targetEmail, messageId);

            return EmailSendResult.builder()
                    .success(true)
                    .messageId(messageId)
                    .message("Email dispatched successfully via Gmail SMTP.")
                    .recipientEmail(targetEmail)
                    .subject(subject)
                    .attachedFiles(attachedFiles)
                    .sentAt(Instant.now())
                    .build();

        } catch (Exception e) {
            log.error("Gmail SMTP dispatch failed for recipient '{}': {}", targetEmail, e.getMessage());
            // Return actual Gmail SMTP error
            throw new RuntimeException("Gmail SMTP error: " + e.getMessage(), e);
        }
    }

    @Override
    public List<EmailSendResult> sendBatch(List<EmailSendRequest> requests) {
        List<EmailSendResult> results = new ArrayList<>();
        if (requests == null || requests.isEmpty()) {
            return results;
        }

        for (EmailSendRequest req : requests) {
            try {
                EmailSendResult res = sendEmail(req);
                results.add(res);
            } catch (Exception e) {
                log.error("Failed batch recipient {}: {}", req.getTo(), e.getMessage());
                results.add(EmailSendResult.builder()
                        .success(false)
                        .recipientEmail(req.getTo())
                        .subject(req.getSubject())
                        .errorMessage(e.getMessage())
                        .message("Failed: " + e.getMessage())
                        .sentAt(Instant.now())
                        .build());
            }
        }
        return results;
    }
}
