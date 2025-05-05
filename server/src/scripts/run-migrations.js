'use strict';

/**
 * Script to manually run database migrations
 * 
 * Usage: node src/scripts/run-migrations.js
 */

const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const { exec } = require('child_process');

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  console.log('Loading environment variables from:', envPath);
  dotenv.config({ path: envPath });
} else {
  console.log('No .env file found, using default environment variables');
  dotenv.config();
}

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quiz_app',
  dialect: 'mysql',
};

console.log('Database connection information:');
console.log(`- Host: ${dbConfig.host}:${dbConfig.port}`);
console.log(`- Database: ${dbConfig.database}`);
console.log(`- User: ${dbConfig.username}`);

// Initialize sequelize
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'mysql',
    logging: console.log,
  }
);

// Main function
async function runMigrations() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection successful!');

    // First try using Sequelize CLI
    console.log('Running migrations using Sequelize CLI...');
    
    runSequelizeCLI((err, result) => {
      if (err) {
        console.error('Error running Sequelize CLI migrations:', err);
        console.log('Falling back to manual migrations...');
        runManualMigrations();
      } else {
        console.log('Sequelize CLI migration output:', result);
        console.log('Migrations completed successfully');
        process.exit(0);
      }
    });
  } catch (error) {
    console.error('Migration process failed:', error);
    process.exit(1);
  }
}

// Function to run migrations using Sequelize CLI
function runSequelizeCLI(callback) {
  const command = 'npx sequelize-cli db:migrate';
  console.log(`Executing command: ${command}`);
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Sequelize CLI error: ${error.message}`);
      return callback(error);
    }
    if (stderr) {
      console.error(`Sequelize CLI stderr: ${stderr}`);
    }
    console.log(`Sequelize CLI stdout: ${stdout}`);
    callback(null, stdout);
  });
}

// Function to run migrations manually
async function runManualMigrations() {
  try {
    console.log('Running manual migrations...');
    
    // Get all migration files
    const migrationsDir = path.resolve(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error('Migrations directory not found:', migrationsDir);
      process.exit(1);
    }
    
    // Read migration files and sort them by filename
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files`);
    
    // Execute each migration
    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      const migration = require(path.join(migrationsDir, file));
      
      if (typeof migration.up === 'function') {
        await migration.up(sequelize.getQueryInterface(), Sequelize);
        console.log(`Migration ${file} completed successfully`);
      } else {
        console.warn(`Migration ${file} has no up function, skipping`);
      }
    }
    
    console.log('All manual migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Manual migration process failed:', error);
    process.exit(1);
  }
}

// Run the migrations
runMigrations(); 