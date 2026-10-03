package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailBatchRecipientDTO {
    private Long id;
    private String studentId;
    private String email;
    private String status;
    private String messageId;
    private String errorMessage;
    private Instant sentAt;
    private Integer retryCount;
}
