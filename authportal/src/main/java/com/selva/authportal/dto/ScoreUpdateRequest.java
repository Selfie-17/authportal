package com.selva.authportal.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request payload for updating the final awarded score/marks of a student evaluation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScoreUpdateRequest {

    @NotBlank(message = "Student ID is required")
    private String studentId;

    @NotBlank(message = "Week is required")
    private String week;

    @NotBlank(message = "Final score is required")
    private String finalScore;

    private Double numericScore;

    // Optional section score updates
    private String objectiveScore;
    private String problemUnderstandingScore;
    private String logicScore;
    private String variablesScore;
    private String observationScore;
    private String totalScore;
}
