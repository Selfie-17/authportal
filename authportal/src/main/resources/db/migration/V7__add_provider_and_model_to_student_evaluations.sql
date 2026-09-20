-- V7__add_provider_and_model_to_student_evaluations.sql
-- Support multi-provider AI evaluations (Gemini, Ollama) and optimize observation report queries

ALTER TABLE student_evaluations
    ADD COLUMN provider VARCHAR(32) NOT NULL DEFAULT 'gemini',
    ADD COLUMN model_name VARCHAR(64) NULL,
    ADD COLUMN grade VARCHAR(16) NULL,
    ADD COLUMN status VARCHAR(32) NULL;

-- Update unique constraint to allow both Gemini and Ollama evaluations for the same student and week
ALTER TABLE student_evaluations DROP INDEX uq_eval_student_week;

ALTER TABLE student_evaluations
    ADD CONSTRAINT uq_eval_student_week_provider UNIQUE (student_id, week, provider);

-- Add index for fast provider-scoped and student lookups
ALTER TABLE student_evaluations
    ADD INDEX idx_eval_student_provider (student_id, provider),
    ADD INDEX idx_eval_provider (provider);
