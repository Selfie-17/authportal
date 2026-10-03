package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Information extracted from an individual student HTML report found within a ZIP archive.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ZipReportItemDTO {
    private String studentId;
    private String email;
    private String studentName;
    private String htmlFileName;
    private long htmlSize;
    private String htmlContent;
    @Builder.Default
    private List<String> companionFiles = new ArrayList<>();
}
