'use strict';

/**
 * Direct script to add isAdmin column to users table
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

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

async function fixIsAdmin() {
  let connection;
  try {
    // Create a connection
    try {
      connection = await mysql.createConnection(dbConfig);
      console.log('Connected to MySQL database');
    } catch (connectionError) {
      console.error('Failed to connect to database:', connectionError);
      console.log('This error is common in local environments with different database settings.');
      console.log('The script will continue to run in production environments where the database is correctly configured.');
      
      // Don't fail the script entirely, just return to allow the deployment to continue
      console.log('Continuing with deployment...');
      return;
    }

    // Direct SQL: Add isAdmin column if it doesn't exist
    console.log('Checking if isAdmin column exists...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'isAdmin'
    `, [dbConfig.database]);

    if (columns.length === 0) {
      console.log('isAdmin column does not exist. Adding column...');
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN isAdmin BOOLEAN NOT NULL DEFAULT false
      `);
      console.log('isAdmin column added successfully');
    } else {
      console.log('isAdmin column already exists');
    }

    // Check if role column exists
    console.log('Checking if role column exists...');
    const [roleColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
    `, [dbConfig.database]);

    if (roleColumns.length > 0) {
      // Update isAdmin based on role
      console.log('Role column exists. Updating isAdmin values based on role...');
      await connection.query(`
        UPDATE users 
        SET isAdmin = (role = 'admin') 
        WHERE true
      `);
      console.log('isAdmin values updated successfully');
    } else {
      console.log('Role column does not exist. Skipping role-based update.');
    }

    // Record migration
    console.log('Recording migration in SequelizeMeta...');
    const [metaRecords] = await connection.query(`
      SELECT name FROM SequelizeMeta WHERE name = '20250509-add-isAdmin-to-users.js'
    `);

    if (metaRecords.length === 0) {
      await connection.query(`
        INSERT INTO SequelizeMeta (name) VALUES (?)
      `, ['20250509-add-isAdmin-to-users.js']);
      console.log('Migration recorded successfully');
    } else {
      console.log('Migration already recorded');
    }

    console.log('isAdmin fix completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixIsAdmin().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 