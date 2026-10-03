package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Summary of batch delivery of HTML reports extracted from a ZIP.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ZipReportsSendResponse {
    private boolean success;
    private Long batchId;
    private int totalProcessed;
    private int successfulCount;
    private int failedCount;
    private String targetOverrideEmail;
    @Builder.Default
    private List<EmailBatchRecipientDTO> results = new ArrayList<>();
    private String message;
}
