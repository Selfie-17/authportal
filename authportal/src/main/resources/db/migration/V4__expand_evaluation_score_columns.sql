-- V4__expand_evaluation_score_columns.sql
-- Expand score column widths in student_evaluations to VARCHAR(255) to prevent any data truncation

ALTER TABLE student_evaluations 
    MODIFY COLUMN objective_score VARCHAR(255) NULL,
    MODIFY COLUMN problem_understanding_score VARCHAR(255) NULL,
    MODIFY COLUMN logic_score VARCHAR(255) NULL,
    MODIFY COLUMN variables_score VARCHAR(255) NULL,
    MODIFY COLUMN observation_score VARCHAR(255) NULL,
    MODIFY COLUMN total_score VARCHAR(255) NULL,
    MODIFY COLUMN final_score VARCHAR(255) NULL;
