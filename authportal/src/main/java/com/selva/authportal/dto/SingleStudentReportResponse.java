package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Detailed single-student evaluation response containing score breakdown,
 * question/program analyses from the JSON, multi-provider support (Gemini, Ollama),
 * and separate teacher feedback.
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

    // Multi-provider metadata
    private String provider;
    private String modelName;
    private String grade;
    private String status;

    @Builder.Default
    private List<String> availableProviders = new ArrayList<>();

    // Multi-provider bundled reports map (e.g. "gemini" -> report, "ollama" -> report)
    private Map<String, SingleStudentReportResponse> reports;

    // Section breakdown (D1–D5 or legacy criteria)
    private String objectiveScore;
    private String problemUnderstandingScore;
    private String logicScore;
    private String variablesScore;
    private String observationScore;
    private String totalScore;

    // Structured Schema 2.0 evaluation data
    private Map<String, Object> criteriaScores;
    private List<String> strengths;
    private List<String> recommendations;

    // Detailed report content
    private String rawEvaluationMarkdown;
    private Map<String, Object> extraction;
    private Map<String, Object> ocr;
    private Map<String, Object> source;

    // Student uploaded PDF submission mapping (derived from Submission -> SubmissionFile)
    private boolean pdfAvailable;
    private String pdfFilename;
    private Long submissionId;
    private Long submissionFileId;

    // Separate teacher feedback layer
    private boolean reviewed;
    private String feedbackText;
}
