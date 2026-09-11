package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.Map;

/**
 * Represents a single student row in the Teacher Evaluation Table.
 * Exactly one row per Student ID.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherEvaluationRowDTO {
    private int rNo;
    private String studentId;
    private String studentName;
    private String profilePicture;
    @Builder.Default
    private Map<String, EvaluationCellDTO> evaluations = new HashMap<>();
}
