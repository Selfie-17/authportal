package com.selva.authportal.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Entity representing an asynchronous batch email operation dispatched via Gmail SMTP.
 */
@Entity
@Table(
        name = "email_batches",
        indexes = {
                @Index(name = "idx_email_batches_status", columnList = "status"),
                @Index(name = "idx_email_batches_week_sec", columnList = "week, section"),
                @Index(name = "idx_email_batches_created_at", columnList = "created_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "academic_year", length = 32)
    private String academicYear;

    @Column(name = "branch", length = 32)
    private String branch;

    @Column(name = "section", length = 32)
    private String section;

    @Column(name = "week", nullable = false, length = 32)
    private String week;

    @Column(name = "subject", nullable = false, length = 255)
    private String subject;

    @Column(name = "provider", nullable = false, length = 32)
    @Builder.Default
    private String provider = "all";

    @Column(name = "report_format", nullable = false, length = 32)
    @Builder.Default
    private String reportFormat = "html";

    @Column(name = "custom_message", columnDefinition = "TEXT")
    private String customMessage;

    @Column(name = "total_recipients", nullable = false)
    @Builder.Default
    private Integer totalRecipients = 0;

    @Column(name = "sent_count", nullable = false)
    @Builder.Default
    private Integer sentCount = 0;

    @Column(name = "failed_count", nullable = false)
    @Builder.Default
    private Integer failedCount = 0;

    @Column(name = "pending_count", nullable = false)
    @Builder.Default
    private Integer pendingCount = 0;

    @Column(name = "status", nullable = false, length = 32)
    @Builder.Default
    private String status = "PENDING"; // PENDING, PROCESSING, COMPLETED, PARTIALLY_FAILED, FAILED

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<EmailBatchRecipient> recipients = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
        if (this.status == null) {
            this.status = "PENDING";
        }
    }
}
