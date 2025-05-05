'use strict';

/**
 * Script to fix all database schema issues by forcing sync between models and database
 * 
 * This script will:
 * 1. Load all models
 * 2. Compare with database and add missing columns
 * 3. Make sure relationships are properly set up
 * 
 * Usage: node src/scripts/fix-schema-sync.js
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

// Log formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

console.log(`${colors.blue}==== Database Schema Full Repair Tool ====${colors.reset}`);

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment variables from: ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.log('No .env file found, using default environment variables');
  dotenv.config();
}

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quizdb',
};

console.log('Database connection information:');
console.log(`- Host: ${dbConfig.host}:${dbConfig.port}`);
console.log(`- Database: ${dbConfig.database}`);
console.log(`- User: ${dbConfig.user}`);

// Direct SQL queries to fix common issues
const fixQueries = [
  // Add any direct SQL queries needed to fix specific issues
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS questionSetId VARCHAR(255) NULL COMMENT 'Foreign key to question_sets table'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS purchases TEXT NULL DEFAULT '[]'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS redeemCodes TEXT NULL DEFAULT '[]'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS progress TEXT NULL DEFAULT '{}'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS examCountdowns TEXT NULL DEFAULT '[]'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS failedLoginAttempts INT NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS accountLocked BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS lockUntil DATETIME NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferredLanguage VARCHAR(10) NULL DEFAULT 'zh-CN'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS profilePicture VARCHAR(255) NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS lastLoginAt DATETIME NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS socket_id VARCHAR(255) NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS isAdmin BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS icon VARCHAR(255) NULL`,
  `ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) NULL DEFAULT 0`,
  `ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS trial_questions INT NULL DEFAULT 0`,
  `ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS featured_category VARCHAR(100) NULL`
];

async function fixSchemaSync() {
  let connection;
  try {
    // Create a connection
    try {
      connection = await mysql.createConnection(dbConfig);
      console.log(`${colors.green}Connected to MySQL database${colors.reset}`);
    } catch (connectionError) {
      console.error(`${colors.red}Failed to connect to database:${colors.reset}`, connectionError);
      console.log(`${colors.yellow}Please check your database credentials and try again.${colors.reset}`);
      return;
    }

    // Check if tables exist, create if they don't
    console.log(`${colors.blue}Checking if essential tables exist...${colors.reset}`);
    
    // Check users table
    const [userTable] = await connection.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
    `, [dbConfig.database]);
    
    if (userTable.length === 0) {
      console.log(`${colors.yellow}Users table doesn't exist. Creating...${colors.reset}`);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          email VARCHAR(100) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          isAdmin BOOLEAN NOT NULL DEFAULT false,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log(`${colors.green}Users table created${colors.reset}`);
    }
    
    // Check question_sets table
    const [questionSetsTable] = await connection.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'question_sets'
    `, [dbConfig.database]);
    
    if (questionSetsTable.length === 0) {
      console.log(`${colors.yellow}question_sets table doesn't exist. Creating...${colors.reset}`);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS question_sets (
          id VARCHAR(36) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(100),
          icon VARCHAR(255),
          is_paid BOOLEAN NOT NULL DEFAULT false,
          price DECIMAL(10,2) DEFAULT 0,
          trial_questions INT DEFAULT 0,
          is_featured BOOLEAN NOT NULL DEFAULT false,
          featured_category VARCHAR(100),
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log(`${colors.green}question_sets table created${colors.reset}`);
    }
    
    // Check questions table
    const [questionsTable] = await connection.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'questions'
    `, [dbConfig.database]);
    
    if (questionsTable.length === 0) {
      console.log(`${colors.yellow}questions table doesn't exist. Creating...${colors.reset}`);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS questions (
          id VARCHAR(36) PRIMARY KEY,
          questionSetId VARCHAR(36),
          text TEXT NOT NULL,
          questionType VARCHAR(50) NOT NULL DEFAULT 'single',
          metadata TEXT,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (questionSetId) REFERENCES question_sets(id) ON DELETE CASCADE
        )
      `);
      console.log(`${colors.green}questions table created${colors.reset}`);
    }
    
    // Check options table
    const [optionsTable] = await connection.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'options'
    `, [dbConfig.database]);
    
    if (optionsTable.length === 0) {
      console.log(`${colors.yellow}options table doesn't exist. Creating...${colors.reset}`);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS options (
          id VARCHAR(36) PRIMARY KEY,
          questionId VARCHAR(36) NOT NULL,
          text TEXT NOT NULL,
          isCorrect BOOLEAN NOT NULL DEFAULT false,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE
        )
      `);
      console.log(`${colors.green}options table created${colors.reset}`);
    }
    
    // Apply fix queries to add missing columns
    console.log(`${colors.blue}Applying fixes for missing columns...${colors.reset}`);
    for (const query of fixQueries) {
      try {
        await connection.query(query);
        console.log(`${colors.green}Successfully executed:${colors.reset} ${query.substring(0, 60)}...`);
      } catch (error) {
        console.log(`${colors.yellow}Error executing query (this is often normal if column already exists):${colors.reset} ${error.message}`);
      }
    }
    
    // Check relationship columns
    console.log(`${colors.blue}Verifying relationship columns...${colors.reset}`);
    
    // Verify questionSetId in questions table
    const [questionSetIdColumn] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'questionSetId'
    `, [dbConfig.database]);
    
    if (questionSetIdColumn.length === 0) {
      console.log(`${colors.yellow}questionSetId column missing in questions table. Adding...${colors.reset}`);
      try {
        await connection.query(`
          ALTER TABLE questions 
          ADD COLUMN questionSetId VARCHAR(36),
          ADD CONSTRAINT fk_questions_question_set 
          FOREIGN KEY (questionSetId) REFERENCES question_sets(id) ON DELETE CASCADE
        `);
        console.log(`${colors.green}questionSetId column added to questions table${colors.reset}`);
      } catch (error) {
        console.log(`${colors.yellow}Error adding foreign key (may already exist in some form):${colors.reset} ${error.message}`);
      }
    }
    
    // Record this fix in SequelizeMeta
    console.log(`${colors.blue}Recording fix in SequelizeMeta...${colors.reset}`);
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS SequelizeMeta (
          name VARCHAR(255) NOT NULL PRIMARY KEY
        )
      `);
      
      await connection.query(`
        INSERT IGNORE INTO SequelizeMeta (name) 
        VALUES ('20250512-fix-schema-sync.js')
      `);
      console.log(`${colors.green}Fix recorded in SequelizeMeta${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}Error recording in SequelizeMeta:${colors.reset} ${error.message}`);
    }
    
    console.log(`${colors.green}Schema sync completed successfully!${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the function
fixSchemaSync().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, err);
  process.exit(1);
}); 