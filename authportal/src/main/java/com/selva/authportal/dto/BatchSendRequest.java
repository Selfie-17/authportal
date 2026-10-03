package com.selva.authportal.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchSendRequest {
    private String year;
    private String branch;
    private String section;

    @NotBlank(message = "Week is required")
    private String week;

    @Builder.Default
    private String provider = "all";

    @Builder.Default
    private String reportFormat = "html";

    private String subject;
    private String customMessage;

    @Builder.Default
    private boolean forceResend = false;

    private List<String> selectedStudentIds;
}
