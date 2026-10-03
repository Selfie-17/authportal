package com.selva.authportal.email;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Result DTO returned after sending an email via Gmail SMTP.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailSendResult {

    private boolean success;
    private String messageId;
    private String message;
    private String recipientEmail;
    private String subject;
    @Builder.Default
    private List<String> attachedFiles = new ArrayList<>();
    private String errorMessage;
    @Builder.Default
    private Instant sentAt = Instant.now();
}
