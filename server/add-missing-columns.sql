-- Add missing columns script
-- Run this with: mysql -u root -p quizdb < add-missing-columns.sql

USE quizdb;

-- Add missing columns to question_sets table
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS icon VARCHAR(255) NULL COMMENT 'Icon URL or identifier for the question set';
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS trial_questions INT NULL DEFAULT 0;
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS featured_category VARCHAR(100) NULL;

-- Show structure of updated question_sets table
DESCRIBE question_sets;

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS socket_id VARCHAR(255) NULL COMMENT 'Socket.io connection ID';
ALTER TABLE users ADD COLUMN IF NOT EXISTS purchases TEXT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS redeemCodes TEXT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS progress TEXT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS examCountdowns TEXT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failedLoginAttempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accountLocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lockUntil DATETIME NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferredLanguage VARCHAR(10) NULL DEFAULT 'zh-CN';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profilePicture VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lastLoginAt DATETIME NULL;

-- Show structure of updated users table
DESCRIBE users;

-- Mark the migration as completed in SequelizeMeta
INSERT IGNORE INTO SequelizeMeta (name) VALUES ('20250511-add-missing-columns.js');

SELECT 'All missing columns added successfully' as 'Status'; 