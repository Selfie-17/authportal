-- V3__create_student_evaluations_tables.sql
-- Schema for Student Evaluations and Teacher Feedback in Academic Portal

CREATE TABLE IF NOT EXISTS student_evaluations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(32) NOT NULL,
    week VARCHAR(32) NOT NULL,
    week_number INT NOT NULL DEFAULT 1,
    section_id VARCHAR(32) NULL,
    objective_score VARCHAR(32) NULL,
    problem_understanding_score VARCHAR(32) NULL,
    logic_score VARCHAR(32) NULL,
    variables_score VARCHAR(32) NULL,
    observation_score VARCHAR(32) NULL,
    total_score VARCHAR(32) NULL,
    final_score VARCHAR(32) NULL,
    assessment TEXT NULL,
    raw_json LONGTEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uq_eval_student_week UNIQUE (student_id, week),
    INDEX idx_eval_student_id (student_id),
    INDEX idx_eval_week (week),
    INDEX idx_eval_week_number (week_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teacher_feedbacks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(32) NOT NULL,
    week VARCHAR(32) NOT NULL,
    reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    feedback_text TEXT NULL,
    teacher_email VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uq_feedback_student_week UNIQUE (student_id, week),
    INDEX idx_feedback_student_week (student_id, week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
