-- V6__add_storage_key_to_submission_files.sql
-- Add provider-neutral storage_key column to submission_files and backfill from submissions.storage_path + stored_filename

ALTER TABLE submission_files
    ADD COLUMN storage_key VARCHAR(512) NULL AFTER stored_filename;

UPDATE submission_files sf
    JOIN submissions s ON sf.submission_id = s.id
    SET sf.storage_key = CONCAT(s.storage_path, '/', sf.stored_filename)
    WHERE sf.storage_key IS NULL;
