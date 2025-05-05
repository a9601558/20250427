'use strict';

/**
 * Script to add missing columns to the database tables
 * 
 * This script adds missing columns to question_sets and users tables
 * to resolve "Unknown column" errors.
 * 
 * Usage: node src/scripts/add-missing-columns.js
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Log formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

console.log(`${colors.blue}==== Database Schema Fix Tool ====${colors.reset}`);

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

async function addMissingColumns() {
  let connection;
  try {
    // Create a connection
    connection = await mysql.createConnection(dbConfig);
    console.log(`${colors.green}Connected to MySQL database${colors.reset}`);

    // Fix question_sets table
    console.log(`${colors.blue}Checking question_sets table...${colors.reset}`);
    
    // Check if question_sets table exists
    const [questionSetsTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'question_sets'
    `, [dbConfig.database]);

    if (questionSetsTables.length === 0) {
      console.log(`${colors.yellow}question_sets table doesn't exist, skipping...${colors.reset}`);
    } else {
      console.log(`${colors.green}Found question_sets table${colors.reset}`);
      
      // Get existing columns
      const [questionSetsColumns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'question_sets'
      `, [dbConfig.database]);
      
      const questionSetsColumnNames = questionSetsColumns.map(column => column.COLUMN_NAME);
      
      // Add icon column if it doesn't exist
      if (!questionSetsColumnNames.includes('icon')) {
        console.log(`Adding 'icon' column to question_sets table...`);
        await connection.query(`
          ALTER TABLE question_sets 
          ADD COLUMN icon VARCHAR(255) NULL 
          COMMENT 'Icon URL or identifier for the question set'
        `);
        console.log(`${colors.green}Added 'icon' column successfully${colors.reset}`);
      } else {
        console.log(`${colors.yellow}'icon' column already exists${colors.reset}`);
      }
      
      // Add is_paid column if it doesn't exist
      if (!questionSetsColumnNames.includes('is_paid')) {
        console.log(`Adding 'is_paid' column to question_sets table...`);
        await connection.query(`
          ALTER TABLE question_sets 
          ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT false
        `);
        console.log(`${colors.green}Added 'is_paid' column successfully${colors.reset}`);
      }
      
      // Add trial_questions column if it doesn't exist
      if (!questionSetsColumnNames.includes('trial_questions')) {
        console.log(`Adding 'trial_questions' column to question_sets table...`);
        await connection.query(`
          ALTER TABLE question_sets 
          ADD COLUMN trial_questions INT NULL DEFAULT 0
        `);
        console.log(`${colors.green}Added 'trial_questions' column successfully${colors.reset}`);
      }
      
      // Add is_featured column if it doesn't exist
      if (!questionSetsColumnNames.includes('is_featured')) {
        console.log(`Adding 'is_featured' column to question_sets table...`);
        await connection.query(`
          ALTER TABLE question_sets 
          ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false
        `);
        console.log(`${colors.green}Added 'is_featured' column successfully${colors.reset}`);
      }
      
      // Add featured_category column if it doesn't exist
      if (!questionSetsColumnNames.includes('featured_category')) {
        console.log(`Adding 'featured_category' column to question_sets table...`);
        await connection.query(`
          ALTER TABLE question_sets 
          ADD COLUMN featured_category VARCHAR(100) NULL
        `);
        console.log(`${colors.green}Added 'featured_category' column successfully${colors.reset}`);
      }
    }
    
    // Fix users table
    console.log(`${colors.blue}Checking users table...${colors.reset}`);
    
    // Check if users table exists
    const [usersTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
    `, [dbConfig.database]);

    if (usersTables.length === 0) {
      console.log(`${colors.yellow}users table doesn't exist, skipping...${colors.reset}`);
    } else {
      console.log(`${colors.green}Found users table${colors.reset}`);
      
      // Get existing columns
      const [usersColumns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
      `, [dbConfig.database]);
      
      const usersColumnNames = usersColumns.map(column => column.COLUMN_NAME);
      
      // Add socket_id column if it doesn't exist
      if (!usersColumnNames.includes('socket_id')) {
        console.log(`Adding 'socket_id' column to users table...`);
        await connection.query(`
          ALTER TABLE users 
          ADD COLUMN socket_id VARCHAR(255) NULL 
          COMMENT 'Socket.io connection ID'
        `);
        console.log(`${colors.green}Added 'socket_id' column successfully${colors.reset}`);
      } else {
        console.log(`${colors.yellow}'socket_id' column already exists${colors.reset}`);
      }
      
      // Add purchases column if it doesn't exist
      if (!usersColumnNames.includes('purchases')) {
        console.log(`Adding 'purchases' column to users table...`);
        await connection.query(`
          ALTER TABLE users 
          ADD COLUMN purchases TEXT NULL DEFAULT '[]'
        `);
        console.log(`${colors.green}Added 'purchases' column successfully${colors.reset}`);
      }
      
      // Add redeemCodes column if it doesn't exist
      if (!usersColumnNames.includes('redeemCodes')) {
        console.log(`Adding 'redeemCodes' column to users table...`);
        await connection.query(`
          ALTER TABLE users 
          ADD COLUMN redeemCodes TEXT NULL DEFAULT '[]'
        `);
        console.log(`${colors.green}Added 'redeemCodes' column successfully${colors.reset}`);
      }
      
      // Add progress column if it doesn't exist
      if (!usersColumnNames.includes('progress')) {
        console.log(`Adding 'progress' column to users table...`);
        await connection.query(`
          ALTER TABLE users 
          ADD COLUMN progress TEXT NULL DEFAULT '{}'
        `);
        console.log(`${colors.green}Added 'progress' column successfully${colors.reset}`);
      }
      
      // Add examCountdowns column if it doesn't exist
      if (!usersColumnNames.includes('examCountdowns')) {
        console.log(`Adding 'examCountdowns' column to users table...`);
        await connection.query(`
          ALTER TABLE users 
          ADD COLUMN examCountdowns TEXT NULL DEFAULT '[]'
        `);
        console.log(`${colors.green}Added 'examCountdowns' column successfully${colors.reset}`);
      }
      
      // Add missing fields from the error log
      const additionalColumns = [
        { name: 'verified', type: 'BOOLEAN NOT NULL DEFAULT false' },
        { name: 'failedLoginAttempts', type: 'INT NOT NULL DEFAULT 0' },
        { name: 'accountLocked', type: 'BOOLEAN NOT NULL DEFAULT false' },
        { name: 'lockUntil', type: 'DATETIME NULL' },
        { name: 'preferredLanguage', type: "VARCHAR(10) NULL DEFAULT 'zh-CN'" },
        { name: 'profilePicture', type: 'VARCHAR(255) NULL' },
        { name: 'lastLoginAt', type: 'DATETIME NULL' }
      ];
      
      for (const col of additionalColumns) {
        if (!usersColumnNames.includes(col.name)) {
          console.log(`Adding '${col.name}' column to users table...`);
          await connection.query(`
            ALTER TABLE users 
            ADD COLUMN ${col.name} ${col.type}
          `);
          console.log(`${colors.green}Added '${col.name}' column successfully${colors.reset}`);
        }
      }
    }
    
    // Add migration record
    console.log(`${colors.blue}Recording migration in SequelizeMeta table...${colors.reset}`);
    try {
      await connection.query(`
        INSERT IGNORE INTO SequelizeMeta (name) 
        VALUES ('20250511-add-missing-columns.js')
      `);
      console.log(`${colors.green}Migration recorded successfully${colors.reset}`);
    } catch (err) {
      console.log(`${colors.yellow}Could not record migration (SequelizeMeta may not exist)${colors.reset}`);
    }
    
    console.log(`${colors.green}All missing columns have been added successfully!${colors.reset}`);
    
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
addMissingColumns().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, err);
  process.exit(1);
}); 