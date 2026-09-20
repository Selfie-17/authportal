package com.selva.authportal.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Entity representing an AI/OCR evaluation record for a student for a specific week.
 *
 * Uniqueness: (studentId, week).
 * When an evaluation for an existing (studentId, week) is uploaded, it replaces the existing record.
 */
@Entity
@Table(
        name = "student_evaluations",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_eval_student_week_provider", columnNames = {"student_id", "week", "provider"})
        },
        indexes = {
                @Index(name = "idx_eval_student_id", columnList = "student_id"),
                @Index(name = "idx_eval_week", columnList = "week"),
                @Index(name = "idx_eval_week_number", columnList = "week_number"),
                @Index(name = "idx_eval_student_provider", columnList = "student_id, provider"),
                @Index(name = "idx_eval_provider", columnList = "provider")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false, length = 32)
    private String studentId;

    @Column(name = "week", nullable = false, length = 32)
    private String week;

    @Column(name = "week_number", nullable = false)
    @Builder.Default
    private Integer weekNumber = 1;

    @Column(name = "provider", nullable = false, length = 32)
    @Builder.Default
    private String provider = "gemini";

    @Column(name = "model_name", length = 64)
    private String modelName;

    @Column(name = "grade", length = 16)
    private String grade;

    @Column(name = "status", length = 32)
    private String status;

    @Column(name = "section_id", length = 32)
    private String sectionId;

    @Column(name = "objective_score", length = 255)
    private String objectiveScore;

    @Column(name = "problem_understanding_score", length = 255)
    private String problemUnderstandingScore;

    @Column(name = "logic_score", length = 255)
    private String logicScore;

    @Column(name = "variables_score", length = 255)
    private String variablesScore;

    @Column(name = "observation_score", length = 255)
    private String observationScore;

    @Column(name = "total_score", length = 255)
    private String totalScore;

    @Column(name = "final_score", length = 255)
    private String finalScore;

    @Column(columnDefinition = "TEXT")
    private String assessment;

    @Lob
    @Column(name = "raw_json", columnDefinition = "LONGTEXT")
    private String rawJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.weekNumber == null) {
            this.weekNumber = 1;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
