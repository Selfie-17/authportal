package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Grid response containing dynamic week column headers and dynamic student rows.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherEvaluationGridResponse {
    @Builder.Default
    private List<String> weeks = new ArrayList<>();
    @Builder.Default
    private List<TeacherEvaluationRowDTO> rows = new ArrayList<>();
    private int totalStudents;
}
