package com.selva.authportal.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Entity representing an individual recipient dispatch status within an EmailBatch.
 */
@Entity
@Table(
        name = "email_batch_recipients",
        indexes = {
                @Index(name = "idx_batch_recipients_batch", columnList = "batch_id"),
                @Index(name = "idx_batch_recipients_student", columnList = "student_id"),
                @Index(name = "idx_batch_recipients_status", columnList = "status")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailBatchRecipient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    @JsonIgnore
    private EmailBatch batch;

    @Column(name = "student_id", nullable = false, length = 32)
    private String studentId;

    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Column(name = "status", nullable = false, length = 32)
    @Builder.Default
    private String status = "PENDING"; // PENDING, SENT, FAILED, SKIPPED

    @Column(name = "message_id", length = 255)
    private String messageId;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "retry_count", nullable = false)
    @Builder.Default
    private Integer retryCount = 0;
}
