package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Status response indicating whether Gmail SMTP credentials are configured and ready.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailStatusResponse {
    @Builder.Default
    private String provider = "GMAIL_SMTP";
    private boolean configured;
    @Builder.Default
    private String host = "smtp.gmail.com";
    @Builder.Default
    private int port = 587;
    private String sender;
    private String senderName;
    private String message;
}
