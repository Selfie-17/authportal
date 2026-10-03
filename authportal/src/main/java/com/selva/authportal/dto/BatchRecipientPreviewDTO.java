package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchRecipientPreviewDTO {
    private String studentId;
    private String name;
    private String email;
    private String section;
    private String year;
    private String branch;
    private boolean hasReport;
    private boolean hasEmail;
    private boolean alreadySent;
    private String status; // "Ready", "Missing Report", "Missing Email", "Already Sent"
    private boolean eligible;
}
