package com.selva.authportal.dto;

import com.selva.authportal.model.TeacherFeedback;
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
    private Long id;
    private String studentId;
    private String week;
    private boolean reviewed;
    private String feedbackText;
    private String teacherEmail;
    private Instant createdAt;
    private Instant updatedAt;

    public static TeacherFeedbackResponse fromEntity(TeacherFeedback entity) {
        if (entity == null) {
            return null;
        }
        return TeacherFeedbackResponse.builder()
                .id(entity.getId())
                .studentId(entity.getStudentId())
                .week(entity.getWeek())
                .reviewed(entity.isReviewed())
                .feedbackText(entity.getFeedbackText())
                .teacherEmail(entity.getTeacherEmail())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
