-- Script to add isAdmin column to users table
USE quizdb;

-- Check if isAdmin column exists
SET @columnExists = 0;
SELECT COUNT(*) INTO @columnExists FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'quizdb' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'isAdmin';

-- Add isAdmin column if it doesn't exist
SET @sql = IF(@columnExists = 0,
    'ALTER TABLE users ADD COLUMN isAdmin BOOLEAN NOT NULL DEFAULT false',
    'SELECT "isAdmin column already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update isAdmin values based on role if role column exists
-- Record migration in SequelizeMeta if table exists
SET @metaTableExists = 0;
SELECT COUNT(*) INTO @metaTableExists FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'quizdb' AND TABLE_NAME = 'SequelizeMeta';

SET @migrationExists = 0;
IF @metaTableExists > 0 THEN
    SELECT COUNT(*) INTO @migrationExists FROM SequelizeMeta 
    WHERE name = '20250509-add-isAdmin-to-users.js';
END IF;

SET @insertSql = IF(@metaTableExists > 0 AND @migrationExists = 0,
    'INSERT INTO SequelizeMeta (name) VALUES ("20250509-add-isAdmin-to-users.js")',
    'SELECT "Migration already recorded or SequelizeMeta table does not exist" AS message');
PREPARE insertStmt FROM @insertSql;
EXECUTE insertStmt;
DEALLOCATE PREPARE insertStmt;

-- Show tables to confirm
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'quizdb' ORDER BY TABLE_NAME; 