package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailBatchResponse {
    private Long id;
    private String academicYear;
    private String branch;
    private String section;
    private String week;
    private String subject;
    private String provider;
    private String reportFormat;
    private String customMessage;
    private int totalRecipients;
    private int sentCount;
    private int failedCount;
    private int pendingCount;
    private String status;
    private String createdBy;
    private Instant createdAt;
    private Instant completedAt;

    @Builder.Default
    private List<EmailBatchRecipientDTO> recipients = new ArrayList<>();
}
