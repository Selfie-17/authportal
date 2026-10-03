package com.selva.authportal.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request payload for sending an evaluated student report via Gmail SMTP email.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentReportEmailRequest {

    @NotBlank(message = "Student ID is required")
    private String studentId;

    @NotBlank(message = "Week is required")
    private String week;

    /**
     * AI provider: 'gemini' | 'ollama' | null (defaults to available)
     */
    private String provider;

    /**
     * Optional recipient email address. If blank, automatically resolves to student's institutional email.
     */
    private String recipientEmail;

    /**
     * Desired report attachment format:
     * - "html" : Standalone rich HTML report file
     * - "gemini" : Raw Gemini JSON report file
     * - "ollama" : Raw Ollama JSON report file
     * - "all" : Both HTML and available JSON reports
     */
    @Builder.Default
    private String reportFormat = "html";

    /**
     * Optional personalized teacher note or instruction included in the email body.
     */
    private String customMessage;

    /**
     * Whether to bypass duplicate protection and force resending this report.
     */
    @Builder.Default
    private boolean forceResend = false;
}
