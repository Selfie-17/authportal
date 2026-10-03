package com.selva.authportal.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Entity holding automation settings for automated email dispatches.
 */
@Entity
@Table(name = "email_automation_configs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailAutomationConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    @Builder.Default
    private Boolean enabled = false;

    @Column(name = "trigger_type", nullable = false, length = 64)
    @Builder.Default
    private String triggerType = "ON_FEEDBACK_SAVED"; // ON_FEEDBACK_SAVED, ON_EVALUATION_UPLOAD, MANUAL

    @Column(name = "academic_year", length = 32)
    private String academicYear;

    @Column(name = "branch", length = 32)
    private String branch;

    @Column(name = "section", length = 32)
    private String section;

    @Column(name = "week", length = 32)
    private String week;

    @Column(name = "report_format", nullable = false, length = 32)
    @Builder.Default
    private String reportFormat = "html";

    @Column(name = "provider", nullable = false, length = 32)
    @Builder.Default
    private String provider = "all";

    @Column(name = "gmail_refresh_token", length = 512)
    private String gmailRefreshToken;

    @Column(name = "gmail_connected_email", length = 255)
    private String gmailConnectedEmail;

    @Column(name = "updated_by", length = 255)
    private String updatedBy;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    protected void onSave() {
        this.updatedAt = Instant.now();
    }
}
