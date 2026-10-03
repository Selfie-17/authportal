-- V10__create_email_batches_tables.sql
-- Table tracking bulk email batches dispatched via Brevo
CREATE TABLE IF NOT EXISTS email_batches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    academic_year VARCHAR(32) NULL,
    branch VARCHAR(32) NULL,
    section VARCHAR(32) NULL,
    week VARCHAR(32) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    provider VARCHAR(32) NOT NULL DEFAULT 'all',
    report_format VARCHAR(32) NOT NULL DEFAULT 'html',
    custom_message TEXT NULL,
    total_recipients INT NOT NULL DEFAULT 0,
    sent_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    pending_count INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_by VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_email_batches_status (status),
    INDEX idx_email_batches_week_sec (week, section),
    INDEX idx_email_batches_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table tracking individual recipient status within an email batch
CREATE TABLE IF NOT EXISTS email_batch_recipients (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    student_id VARCHAR(32) NOT NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    brevo_message_id VARCHAR(255) NULL,
    error_message TEXT NULL,
    sent_at TIMESTAMP NULL,
    retry_count INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_batch_recipients_batch FOREIGN KEY (batch_id) REFERENCES email_batches(id) ON DELETE CASCADE,
    INDEX idx_batch_recipients_batch (batch_id),
    INDEX idx_batch_recipients_student (student_id),
    INDEX idx_batch_recipients_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table storing automation configurations
CREATE TABLE IF NOT EXISTS email_automation_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    trigger_type VARCHAR(64) NOT NULL DEFAULT 'ON_FEEDBACK_SAVED',
    academic_year VARCHAR(32) NULL,
    branch VARCHAR(32) NULL,
    section VARCHAR(32) NULL,
    week VARCHAR(32) NULL,
    report_format VARCHAR(32) NOT NULL DEFAULT 'html',
    provider VARCHAR(32) NOT NULL DEFAULT 'all',
    updated_by VARCHAR(255) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
