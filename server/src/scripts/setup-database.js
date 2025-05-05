/**
 * Database Setup Script
 * 
 * This script helps configure the MySQL database for the application.
 * It provides SQL commands to:
 * 1. Create the database
 * 2. Create a user with the appropriate permissions
 * 3. Add necessary columns like metadata to tables
 */

console.log('=== Database Setup Guide ===');
console.log('Run the following commands in your MySQL client to set up your database:\n');

console.log('-- 1. Create the database');
console.log('CREATE DATABASE IF NOT EXISTS quiz_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n');

console.log('-- 2. Create a user (or use root)');
console.log('-- Option A: Create a dedicated user (recommended for production)');
console.log('CREATE USER IF NOT EXISTS \'quizuser\'@\'localhost\' IDENTIFIED BY \'your_password\';');
console.log('GRANT ALL PRIVILEGES ON quiz_app.* TO \'quizuser\'@\'localhost\';');
console.log('FLUSH PRIVILEGES;\n');

console.log('-- Option B: Use root user (simpler for development)');
console.log('-- No action required, just use root in your .env file\n');

console.log('-- 3. Add metadata column to questions table if it doesn\'t exist');
console.log('USE quiz_app;');
console.log('ALTER TABLE questions ADD COLUMN IF NOT EXISTS metadata TEXT COMMENT \'JSON metadata for storing additional question information\';\n');

console.log('=== Environment Configuration (.env file) ===');
console.log('Make sure your .env file in the server directory has the following settings:');
console.log('DB_HOST=localhost');
console.log('DB_PORT=3306');
console.log('DB_NAME=quiz_app');
console.log('DB_USER=root     # Or quizuser if you created a dedicated user');
console.log('DB_PASSWORD=     # Your database password (leave empty for no password with root)');

console.log('\n=== Database Connection Troubleshooting ===');
console.log('1. If you see "Access denied" errors, check your database user and password');
console.log('2. If the database or tables don\'t exist, make sure migrations have been run: npm run migrate');
console.log('3. For metadata column errors, run the ALTER TABLE command above');
console.log('4. If using the quizuser account, make sure it has proper permissions on the database');

console.log('\nFor more detailed instructions, see the README.md file.');

// Provide a version of the .env file for easy copying
console.log('\n=== Sample .env file for server directory ===');
console.log(`NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=quiz_app
JWT_SECRET=dev_secret_key
JWT_EXPIRES_IN=30d
ALLOW_PUBLIC_PROGRESS=true`);

console.log('\nAfter configuring your database, restart the server with: npm run start'); 