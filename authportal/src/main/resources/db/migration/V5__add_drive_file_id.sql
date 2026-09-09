-- V5__add_drive_file_id.sql
-- Add drive_file_id column to submission_files for direct Google Drive object identification

ALTER TABLE submission_files
    ADD COLUMN drive_file_id VARCHAR(255) NULL AFTER stored_filename;
