package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Compact evaluation summary displayed within a single week cell of the teacher table.
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
}
