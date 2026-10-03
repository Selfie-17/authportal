-- V12: Add Gmail REST API refresh token and connected email to email automation config
ALTER TABLE email_automation_configs
    ADD COLUMN gmail_refresh_token VARCHAR(512) NULL AFTER provider,
    ADD COLUMN gmail_connected_email VARCHAR(255) NULL AFTER gmail_refresh_token;
