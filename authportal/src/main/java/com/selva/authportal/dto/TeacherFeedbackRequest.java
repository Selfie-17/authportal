package com.selva.authportal.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherFeedbackRequest {

    @NotBlank(message = "Student ID is required")
    private String studentId;

    @NotBlank(message = "Week is required")
    private String week;

    private Boolean reviewed;

    private String feedbackText;
}
