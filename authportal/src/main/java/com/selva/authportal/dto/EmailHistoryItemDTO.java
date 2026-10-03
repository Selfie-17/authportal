package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * DTO representing an individual email dispatch record in the Email History table.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailHistoryItemDTO {
    private Long id;
    private Long batchId;
    private String studentId;
    private String studentName;
    private String email;
    private String subject;
    private String status; // SENT, FAILED, RETRYING, PENDING
    private String messageId;
    private String errorMessage;
    private Instant sentAt;
    private Integer retryCount;
}
