package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Result returned after analyzing a ZIP archive of HTML evaluation reports.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ZipReportsParseResponse {
    private boolean success;
    private int totalReports;
    @Builder.Default
    private List<ZipReportItemDTO> reports = new ArrayList<>();
    private String detectedWeek;
    private String detectedYear;
    private String detectedSection;
    private String sourceName;
    private String message;
    private String errorMessage;
}
