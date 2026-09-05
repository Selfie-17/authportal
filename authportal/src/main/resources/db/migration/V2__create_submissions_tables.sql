-- V2__create_submissions_tables.sql
-- Submissions and submission files schema for Academic C-Program Portal

CREATE TABLE IF NOT EXISTS submissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    student_id VARCHAR(16) NOT NULL,
    week INT NOT NULL,
    year VARCHAR(10) NOT NULL,
    section INT NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    version INT NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_submissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_week_year_sec UNIQUE (user_id, week, year, section),
    INDEX idx_submissions_week_sec (week, section),
    INDEX idx_submissions_filters (week, year, section),
    INDEX idx_submissions_student_id (student_id),
    INDEX idx_submissions_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submission_files (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    submission_id BIGINT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_extension VARCHAR(16) NOT NULL,
    file_type VARCHAR(30) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_files_submission FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    INDEX idx_files_submission (submission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
