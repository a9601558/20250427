/**
 * This script generates the SQL needed to add the metadata column to the questions table
 * You can run this SQL directly in your database client
 */

console.log('=== SQL to add metadata column to questions table ===');
console.log(`
-- First check if the column already exists
SET @dbname = DATABASE();
SET @tablename = 'questions';
SET @columnname = 'metadata';
SET @preparedStatement = (
  SELECT IF(
    (
      SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE 
        TABLE_SCHEMA = @dbname
        AND TABLE_NAME = @tablename
        AND COLUMN_NAME = @columnname
    ) > 0,
    'SELECT "Column already exists. No action needed." AS result;',
    'ALTER TABLE questions ADD COLUMN metadata TEXT COMMENT "JSON metadata for storing additional question information";'
  )
);

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
`);

console.log('\n=== Usage Instructions ===');
console.log('1. Copy the SQL above');
console.log('2. Open your MySQL client (e.g., MySQL Workbench, phpMyAdmin)');
console.log('3. Make sure you\'re connected to the correct database');
console.log('4. Paste and execute the SQL');
console.log('5. The metadata column will be added if it doesn\'t already exist\n');

// Also print direct ALTER TABLE statement for those who want to run it directly
console.log('=== Direct ALTER TABLE statement ===');
console.log('ALTER TABLE questions ADD COLUMN metadata TEXT COMMENT "JSON metadata for storing additional question information";'); 