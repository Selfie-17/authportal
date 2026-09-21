-- V8__add_branch_year_section_to_users.sql
-- Adds branch, academic year, and section to users table and defaults existing students to CSE

ALTER TABLE users
    ADD COLUMN branch VARCHAR(50) NULL AFTER role,
    ADD COLUMN academic_year VARCHAR(50) NULL AFTER branch,
    ADD COLUMN section VARCHAR(50) NULL AFTER academic_year;

CREATE INDEX idx_users_branch ON users (branch);

-- Default all registered students in the database to Computer Science & Engineering (CSE)
UPDATE users
SET branch = 'CSE'
WHERE role = 'STUDENT' AND (branch IS NULL OR branch = '');
