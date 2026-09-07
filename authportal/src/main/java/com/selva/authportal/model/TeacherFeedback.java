package com.selva.authportal.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Entity representing human teacher review and feedback for a student and week.
 *
 * Stored completely independently from the AI evaluation:
 * - AI scores, sections, and evaluations are NEVER modified by teacher feedback.
 * - Keyed by (studentId, week).
 */
@Entity
@Table(
        name = "teacher_feedbacks",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_feedback_student_week", columnNames = {"student_id", "week"})
        },
        indexes = {
                @Index(name = "idx_feedback_student_week", columnList = "student_id, week")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeacherFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false, length = 32)
    private String studentId;

    @Column(name = "week", nullable = false, length = 32)
    private String week;

    @Column(nullable = false)
    @Builder.Default
    private boolean reviewed = false;

    @Column(name = "feedback_text", columnDefinition = "TEXT")
    private String feedbackText;

    @Column(name = "teacher_email")
    private String teacherEmail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
