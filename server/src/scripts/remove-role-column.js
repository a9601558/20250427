'use strict';

/**
 * Script to remove role column from users table
 * 
 * This script ensures the isAdmin column exists with correct values,
 * then removes the role column from the users table.
 * 
 * Usage: node src/scripts/remove-role-column.js
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

console.log(`${colors.blue}==== Role Column Removal Tool ====${colors.reset}`);

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
  database: process.env.DB_NAME || 'quiz_app',
};

console.log('Database connection information:');
console.log(`- Host: ${dbConfig.host}:${dbConfig.port}`);
console.log(`- Database: ${dbConfig.database}`);
console.log(`- User: ${dbConfig.user}`);

async function removeRoleColumn() {
  let connection;
  try {
    // Create a connection
    connection = await mysql.createConnection(dbConfig);
    console.log(`${colors.green}Connected to MySQL database${colors.reset}`);

    // Check if users table exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
    `, [dbConfig.database]);

    if (tables.length === 0) {
      console.log(`${colors.yellow}users table does not exist. Nothing to do.${colors.reset}`);
      return;
    }

    // Check if isAdmin column exists
    const [isAdminColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'isAdmin'
    `, [dbConfig.database]);

    // Add isAdmin column if it doesn't exist
    if (isAdminColumns.length === 0) {
      console.log(`${colors.yellow}isAdmin column does not exist. Adding it first...${colors.reset}`);
      
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN isAdmin BOOLEAN NOT NULL DEFAULT false
      `);
      
      console.log(`${colors.green}isAdmin column added successfully${colors.reset}`);
    }

    // Check if role column exists
    const [roleColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
    `, [dbConfig.database]);

    if (roleColumns.length === 0) {
      console.log(`${colors.yellow}role column does not exist. Nothing to do.${colors.reset}`);
      return;
    }

    // Update isAdmin based on role before removing
    console.log(`${colors.blue}Updating isAdmin values based on role column...${colors.reset}`);
    
    await connection.query(`
      UPDATE users
      SET isAdmin = (role = 'admin')
      WHERE true
    `);
    
    console.log(`${colors.green}isAdmin values updated successfully${colors.reset}`);

    // Remove role column
    console.log(`${colors.blue}Removing role column from users table...${colors.reset}`);
    
    await connection.query(`
      ALTER TABLE users
      DROP COLUMN role
    `);
    
    console.log(`${colors.green}role column removed successfully${colors.reset}`);

    // Add entry to SequelizeMeta for both migrations
    const [metaTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'SequelizeMeta'
    `, [dbConfig.database]);

    if (metaTables.length > 0) {
      console.log(`${colors.blue}Recording migrations in SequelizeMeta table...${colors.reset}`);
      
      await connection.query(`
        INSERT IGNORE INTO SequelizeMeta (name) VALUES 
        ('20250509-add-isAdmin-to-users.js'),
        ('20250510-remove-role-from-users.js')
      `);
      
      console.log(`${colors.green}Migrations recorded successfully${colors.reset}`);
    }

    console.log(`${colors.green}Role column removal completed successfully${colors.reset}`);
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
removeRoleColumn().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, err);
  process.exit(1);
}); 