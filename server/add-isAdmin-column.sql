-- Add isAdmin column to users table
-- Run this with: mysql -u root -p quizdb < add-isAdmin-column.sql
USE quizdb;

-- Add isAdmin column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS isAdmin BOOLEAN NOT NULL DEFAULT false;

-- Update isAdmin based on role column
UPDATE users SET isAdmin = (role = 'admin') WHERE true;

-- Display updated users table structure
DESCRIBE users;

-- Insert migration record to prevent future migrations from running
INSERT IGNORE INTO SequelizeMeta (name) VALUES ('20250509-add-isAdmin-to-users.js'); 