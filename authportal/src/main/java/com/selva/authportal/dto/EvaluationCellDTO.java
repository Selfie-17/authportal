package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Compact evaluation summary displayed within a single week cell of the teacher table.
 * Supports multi-provider evaluations (Gemini, Ollama).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvaluationCellDTO {
    private String studentId;
    private String week;
    private String objectiveScore;
    private String problemUnderstandingScore;
    private String logicScore;
    private String variablesScore;
    private String observationScore;
    private String totalScore;
    private String finalScore;
    private boolean reviewed;
    private String feedbackText;

    // Multi-provider metadata
    private String provider;
    private String modelName;
    private String grade;
    private String status;

    @Builder.Default
    private List<String> availableProviders = new ArrayList<>();

    private String geminiScore;
    private String ollamaScore;

    @Builder.Default
    private Map<String, ProviderSummaryDTO> providers = new HashMap<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProviderSummaryDTO {
        private String provider;
        private String modelName;
        private String finalScore;
        private String totalScore;
        private String grade;
        private String status;
        private String objectiveScore;
        private String problemUnderstandingScore;
        private String logicScore;
        private String variablesScore;
        private String observationScore;
    }
}
