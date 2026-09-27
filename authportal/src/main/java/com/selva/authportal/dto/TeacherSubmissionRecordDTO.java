package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * DTO representing an individual student submission combined with PDF details
 * and teacher feedback/review status for the review page.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherSubmissionRecordDTO {

    private Long id; // Submission record ID
    private String studentId;
    private String studentName;
    private String studentEmail;
    private String studentProfilePicture;
    private Integer week;
    private String weekDisplay; // e.g. "Week 1"
    private String year; // e.g. "E1"
    private Integer section;
    private String branch;
    private Integer version;
    private Instant submittedAt;
    private Instant submissionUpdatedAt;

    // PDF file details
    private boolean hasPdf;
    private Long pdfFileId;
    private String pdfFileName;
    private Long pdfSizeBytes;

    // Teacher feedback details
    private Long feedbackId;
    private boolean reviewed;
    private String feedbackText;
    private String teacherEmail;
    private Instant feedbackUpdatedAt;
}
