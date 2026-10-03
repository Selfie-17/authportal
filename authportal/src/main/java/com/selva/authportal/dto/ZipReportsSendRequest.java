package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Request payload for sending HTML reports extracted from a ZIP archive.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ZipReportsSendRequest {
    private String year;
    private String week;
    private String section;
    private String facultyMessage;
    private String targetOverrideEmail;
    private String sourceFilePath;
    @Builder.Default
    private List<String> selectedStudentIds = new ArrayList<>();
}
