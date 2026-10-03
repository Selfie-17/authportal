-- V11__migrate_to_gmail_message_id.sql
-- Rename brevo_message_id column to generic message_id for Gmail SMTP
ALTER TABLE email_batch_recipients CHANGE COLUMN brevo_message_id message_id VARCHAR(255) NULL;
