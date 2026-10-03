package com.selva.authportal.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestEmailRequest {
    private String studentId;

    @NotBlank(message = "Week is required")
    private String week;

    @Builder.Default
    private String provider = "all";

    @NotBlank(message = "Test recipient email is required")
    @Email(message = "Invalid recipient email format")
    private String testRecipientEmail;

    @Builder.Default
    private String reportFormat = "html";

    private String customMessage;
}
