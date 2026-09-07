package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Detailed single-student evaluation response containing score breakdown,
 * question/program analyses from the JSON, and separate teacher feedback.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SingleStudentReportResponse {
    private String studentId;
    private String week;
    private String sectionId;
    private String finalScore;
    private String assessment;

    // Section breakdown
    private String objectiveScore;
    private String problemUnderstandingScore;
    private String logicScore;
    private String variablesScore;
    private String observationScore;
    private String totalScore;

    // Detailed report content
    private String rawEvaluationMarkdown;
    private Map<String, Object> extraction;

    // Separate teacher feedback layer
    private boolean reviewed;
    private String feedbackText;
}
