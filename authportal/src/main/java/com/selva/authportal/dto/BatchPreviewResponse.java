package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchPreviewResponse {
    private int totalStudents;
    private int readyCount;
    private int missingReportsCount;
    private int missingEmailsCount;
    private int alreadySentCount;

    @Builder.Default
    private List<BatchRecipientPreviewDTO> recipients = new ArrayList<>();
}
