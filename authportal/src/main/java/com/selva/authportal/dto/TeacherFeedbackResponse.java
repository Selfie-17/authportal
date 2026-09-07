package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherFeedbackResponse {
    private String studentId;
    private String week;
    private boolean reviewed;
    private String feedbackText;
    private String teacherEmail;
    private Instant updatedAt;
}
