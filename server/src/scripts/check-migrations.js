'use strict';

/**
 * Script to check status of database migrations without running them
 * 
 * Usage: node src/scripts/check-migrations.js
 */

const path = require('path');
const fs = require('fs');
const { Sequelize, QueryTypes } = require('sequelize');
const dotenv = require('dotenv');

// Log formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

console.log(`${colors.blue}==== Migration Status Check ====${colors.reset}\n`);

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment variables from: ${colors.cyan}${envPath}${colors.reset}`);
  dotenv.config({ path: envPath });
} else {
  console.log(`${colors.yellow}No .env file found, using default environment variables${colors.reset}`);
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

console.log(`\nDatabase connection information:`);
console.log(`- Host: ${colors.cyan}${dbConfig.host}:${dbConfig.port}${colors.reset}`);
console.log(`- Database: ${colors.cyan}${dbConfig.database}${colors.reset}`);
console.log(`- User: ${colors.cyan}${dbConfig.username}${colors.reset}`);

// Initialize sequelize
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'mysql',
    logging: false,
  }
);

// Main function
async function checkMigrations() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log(`\n${colors.green}✓ Database connection successful!${colors.reset}`);
    
    // Get all migration files
    const migrationsDir = path.resolve(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error(`${colors.red}✗ Migrations directory not found:${colors.reset} ${migrationsDir}`);
      process.exit(1);
    }
    
    // Read migration files and sort them by filename
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();
    
    console.log(`\nFound ${colors.cyan}${migrationFiles.length}${colors.reset} migration files in ${colors.cyan}${migrationsDir}${colors.reset}`);
    
    // Check if SequelizeMeta table exists
    const tables = await sequelize.getQueryInterface().showAllTables();
    let completedMigrations = [];
    
    if (tables.includes('SequelizeMeta')) {
      console.log(`\n${colors.green}✓ SequelizeMeta table exists${colors.reset}`);
      
      // Get completed migrations
      const results = await sequelize.query('SELECT name FROM SequelizeMeta', {
        type: QueryTypes.SELECT
      });
      
      completedMigrations = results.map(row => row.name);
      console.log(`${colors.green}✓ ${completedMigrations.length}${colors.reset} migrations have been applied`);
    } else {
      console.log(`\n${colors.yellow}! SequelizeMeta table does not exist - no migrations have been applied${colors.reset}`);
    }
    
    // Calculate pending migrations
    const pendingMigrations = migrationFiles.filter(file => !completedMigrations.includes(file));
    
    console.log(`\n${colors.yellow}${pendingMigrations.length}${colors.reset} migrations are pending\n`);
    
    // Display table of migrations
    console.log(`${colors.magenta}┌${'─'.repeat(10)}┬${'─'.repeat(50)}┬${'─'.repeat(15)}┐${colors.reset}`);
    console.log(`${colors.magenta}│${colors.cyan} Status    ${colors.magenta}│${colors.cyan} Migration Name                                ${colors.magenta}│${colors.cyan} Type          ${colors.magenta}│${colors.reset}`);
    console.log(`${colors.magenta}├${'─'.repeat(10)}┼${'─'.repeat(50)}┼${'─'.repeat(15)}┤${colors.reset}`);
    
    // Print each migration with status
    for (const file of migrationFiles) {
      const isApplied = completedMigrations.includes(file);
      const status = isApplied 
        ? `${colors.green} ✓ Applied ${colors.reset}` 
        : `${colors.yellow} ⨯ Pending  ${colors.reset}`;
      
      let type = "Unknown";
      try {
        const migration = require(path.join(migrationsDir, file));
        if (typeof migration.up === 'function') {
          const upFnString = migration.up.toString();
          if (upFnString.includes('createTable')) {
            type = `${colors.cyan}Create Table${colors.reset}`;
          } else if (upFnString.includes('addColumn')) {
            type = `${colors.blue}Add Column${colors.reset}`;
          } else if (upFnString.includes('removeColumn')) {
            type = `${colors.yellow}Drop Column${colors.reset}`;
          } else if (upFnString.includes('changeColumn')) {
            type = `${colors.magenta}Change Column${colors.reset}`;
          } else {
            type = `${colors.white}Modify Data${colors.reset}`;
          }
        } else {
          type = `${colors.red}Invalid${colors.reset}`;
        }
      } catch (error) {
        console.error(`Error loading migration ${file}:`, error);
        type = `${colors.red}Error${colors.reset}`;
      }
      
      // Format the name to fit in column
      const truncatedName = file.length > 48 ? file.substring(0, 45) + '...' : file.padEnd(48);
      
      console.log(`${colors.magenta}│${colors.reset} ${status} ${colors.magenta}│${colors.reset} ${truncatedName} ${colors.magenta}│${colors.reset} ${type.padEnd(13)} ${colors.magenta}│${colors.reset}`);
    }
    
    console.log(`${colors.magenta}└${'─'.repeat(10)}┴${'─'.repeat(50)}┴${'─'.repeat(15)}┘${colors.reset}`);
    
    // Display database tables
    console.log(`\n${colors.blue}Database Tables:${colors.reset}`);
    console.log(`Found ${colors.cyan}${tables.length}${colors.reset} tables in database:`);
    
    // Group tables into columns for better display
    const columns = 3;
    const rowCount = Math.ceil(tables.length / columns);
    
    for (let i = 0; i < rowCount; i++) {
      let row = '';
      for (let j = 0; j < columns; j++) {
        const index = i + j * rowCount;
        if (index < tables.length) {
          row += `  ${colors.cyan}${tables[index].padEnd(25)}${colors.reset}`;
        }
      }
      console.log(row);
    }
    
    // Provide summary and advice
    console.log(`\n${colors.blue}Summary:${colors.reset}`);
    console.log(`- Total migrations: ${colors.cyan}${migrationFiles.length}${colors.reset}`);
    console.log(`- Applied migrations: ${colors.green}${completedMigrations.length}${colors.reset}`);
    console.log(`- Pending migrations: ${colors.yellow}${pendingMigrations.length}${colors.reset}`);
    
    console.log(`\n${colors.blue}Recommended Actions:${colors.reset}`);
    if (pendingMigrations.length > 0) {
      console.log(`- Run migrations: ${colors.cyan}npm run migrations${colors.reset}`);
      console.log(`- Or with forced continuation: ${colors.cyan}npm run migrations:continue${colors.reset}`);
    } else {
      console.log(`- ${colors.green}All migrations are up to date!${colors.reset}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`\n${colors.red}Migration check failed:${colors.reset}`, error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the check
checkMigrations(); 