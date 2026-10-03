package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailStatisticsResponse {
    private long emailsSentToday;
    private long pendingEmails;
    private long successfullySent;
    private long failedEmails;
    private long todayLocallyTrackedCount;
    private String capacityNote;
    private boolean configured;
    private String senderEmail;
    private String senderName;
}
