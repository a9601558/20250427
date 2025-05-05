'use strict';

/**
 * Script to add isAdmin column to users table
 * 
 * This script directly adds the isAdmin column to the users table
 * and syncs its values with the role column.
 * 
 * Usage: node src/scripts/add-isAdmin-column.js
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

console.log(`${colors.blue}==== isAdmin Column Fix Tool ====${colors.reset}`);

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

async function addIsAdminColumn() {
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
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'isAdmin'
    `, [dbConfig.database]);

    if (columns.length > 0) {
      console.log(`${colors.yellow}isAdmin column already exists in users table${colors.reset}`);
    } else {
      // Add the isAdmin column
      console.log(`${colors.blue}Adding isAdmin column to users table...${colors.reset}`);
      
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

    if (roleColumns.length > 0) {
      // Update isAdmin based on role
      console.log(`${colors.blue}Updating isAdmin values based on role column...${colors.reset}`);
      
      await connection.query(`
        UPDATE users
        SET isAdmin = (role = 'admin')
        WHERE true
      `);
      
      console.log(`${colors.green}isAdmin values updated successfully${colors.reset}`);
    } else {
      console.log(`${colors.yellow}role column does not exist in users table. Can't sync values.${colors.reset}`);
    }

    // Add entry to SequelizeMeta
    const [metaTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'SequelizeMeta'
    `, [dbConfig.database]);

    if (metaTables.length > 0) {
      // Check if migration record exists
      const [migrations] = await connection.query(`
        SELECT name 
        FROM SequelizeMeta 
        WHERE name = '20250509-add-isAdmin-to-users.js'
      `);

      if (migrations.length === 0) {
        console.log(`${colors.blue}Recording migration in SequelizeMeta table...${colors.reset}`);
        
        await connection.query(`
          INSERT INTO SequelizeMeta (name) 
          VALUES ('20250509-add-isAdmin-to-users.js')
        `);
        
        console.log(`${colors.green}Migration recorded successfully${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Migration already recorded in SequelizeMeta table${colors.reset}`);
      }
    }

    console.log(`${colors.green}isAdmin column fix completed successfully${colors.reset}`);
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
addIsAdminColumn().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, err);
  process.exit(1);
}); 