package com.selva.authportal.email;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Standard request DTO for sending an email via EmailService.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailSendRequest {

    @NotBlank(message = "Recipient email is required")
    private String to;

    private String toName;

    private String subject;

    private String body;

    @Builder.Default
    private boolean html = true;

    private String customMessage;

    @Builder.Default
    private List<EmailAttachment> attachments = new ArrayList<>();
}
