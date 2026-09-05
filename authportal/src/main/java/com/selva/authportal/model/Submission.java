package com.selva.authportal.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Entity representing an academic C-program lab submission.
 * Each submission belongs to:
 * - An authenticated User (ownership & security anchor)
 * - Academic Student ID (folder naming and metadata label)
 * - Week (1–12)
 * - Year (E1–E4)
 * - Section (1–6)
 *
 * The storage hierarchy on disk strictly follows:
 * submissions/week-{week}/sec-{section}/{studentId}/
 * Year is database metadata used for teacher filtering.
 *
 * The version field acts as a revision counter: replacement submissions
 * increment this counter and replace previous physical files on disk.
 */
@Entity
@Table(
        name = "submissions",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_user_week_year_sec", columnNames = {"user_id", "week", "year", "section"})
        },
        indexes = {
                @Index(name = "idx_submissions_week_sec", columnList = "week, section"),
                @Index(name = "idx_submissions_filters", columnList = "week, year, section"),
                @Index(name = "idx_submissions_student_id", columnList = "student_id"),
                @Index(name = "idx_submissions_user_id", columnList = "user_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Submission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "student_id", nullable = false, length = 16)
    private String studentId;

    @Column(nullable = false)
    private Integer week;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private YearLevel year;

    @Column(nullable = false)
    private Integer section;

    @Column(name = "storage_path", nullable = false, length = 512)
    private String storagePath;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private SubmissionStatus status = SubmissionStatus.SUBMITTED;

    /**
     * Revision counter indicating how many times this student has submitted
     * for this specific week, year, and section.
     */
    @Column(nullable = false)
    @Builder.Default
    private Integer version = 1;

    @OneToMany(mappedBy = "submission", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SubmissionFile> files = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
        this.updatedAt = Instant.now();
        if (this.version == null) {
            this.version = 1;
        }
        if (this.status == null) {
            this.status = SubmissionStatus.SUBMITTED;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public void addFile(SubmissionFile file) {
        files.add(file);
        file.setSubmission(this);
    }

    public void removeFile(SubmissionFile file) {
        files.remove(file);
        file.setSubmission(null);
    }
}
