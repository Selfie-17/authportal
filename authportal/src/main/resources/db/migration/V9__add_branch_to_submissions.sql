-- Add branch column to submissions table for academic branch metadata
ALTER TABLE submissions ADD COLUMN branch VARCHAR(50);
