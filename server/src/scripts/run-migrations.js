'use strict';

/**
 * Script to manually run database migrations
 * 
 * Usage: node src/scripts/run-migrations.js
 */

const path = require('path');
const fs = require('fs');
const { Sequelize, DataTypes, QueryTypes } = require('sequelize');
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
    
    try {
      const result = await runSequelizeCLI();
      console.log('Sequelize CLI migration output:', result);
      console.log('Migrations completed successfully');
      process.exit(0);
    } catch (cliError) {
      console.error('Error running Sequelize CLI migrations:', cliError);
      console.log('Falling back to manual migrations...');
      await runManualMigrations();
    }
  } catch (error) {
    console.error('Migration process failed:', error);
    process.exit(1);
  }
}

// Function to run migrations using Sequelize CLI
function runSequelizeCLI() {
  return new Promise((resolve, reject) => {
    const command = 'npx sequelize-cli db:migrate';
    console.log(`Executing command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Sequelize CLI error: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`Sequelize CLI stderr: ${stderr}`);
      }
      console.log(`Sequelize CLI stdout: ${stdout}`);
      resolve(stdout);
    });
  });
}

// Function to run migrations manually
async function runManualMigrations() {
  try {
    console.log('Running manual migrations...');
    
    // Ensure SequelizeMeta table exists to track migrations
    await createMigrationTable();
    
    // Get completed migrations
    const completedMigrations = await getCompletedMigrations();
    console.log('Already completed migrations:', completedMigrations);
    
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
    
    // Track successful migrations
    let successfulMigrations = 0;
    let failedMigrations = 0;
    
    // Execute each migration that hasn't been completed
    for (const file of migrationFiles) {
      if (completedMigrations.includes(file)) {
        console.log(`Migration ${file} already executed, skipping`);
        continue;
      }
      
      try {
        console.log(`Running migration: ${file}`);
        const migration = require(path.join(migrationsDir, file));
        
        if (typeof migration.up === 'function') {
          // Provide backward compatibility for migrations using queryInterface.query
          const enhancedQueryInterface = enhanceQueryInterface(sequelize.getQueryInterface());
          
          // Run the migration
          await migration.up(enhancedQueryInterface, Sequelize);
          
          // Record migration as completed
          await recordMigration(file);
          
          console.log(`Migration ${file} completed successfully`);
          successfulMigrations++;
        } else {
          console.warn(`Migration ${file} has no up function, skipping`);
        }
      } catch (error) {
        console.error(`Migration failed: ${file}`, error);
        failedMigrations++;
        
        // Continue with other migrations - don't let one failure stop all migrations
        if (process.env.CONTINUE_ON_MIGRATION_ERROR === 'true') {
          console.log('Continuing with next migration due to CONTINUE_ON_MIGRATION_ERROR=true');
          continue;
        } else {
          throw new Error(`Migration ${file} failed: ${error.message}`);
        }
      }
    }
    
    console.log(`Manual migrations completed. Success: ${successfulMigrations}, Failed: ${failedMigrations}`);
    
    if (failedMigrations > 0 && process.env.CONTINUE_ON_MIGRATION_ERROR !== 'true') {
      throw new Error(`${failedMigrations} migrations failed`);
    }
    
    process.exit(failedMigrations > 0 ? 1 : 0);
  } catch (error) {
    console.error('Manual migration process failed:', error);
    process.exit(1);
  }
}

// Function to enhance QueryInterface with a query method for backward compatibility
function enhanceQueryInterface(queryInterface) {
  return {
    ...queryInterface,
    // Add a query method for backward compatibility
    query: async function(sql, options = {}) {
      console.log('Using enhanced queryInterface.query with:', sql);
      return await sequelize.query(sql, {
        type: QueryTypes.RAW,
        ...options
      });
    },
    // Pass through all other methods
    showAllTables: queryInterface.showAllTables.bind(queryInterface),
    dropTable: queryInterface.dropTable.bind(queryInterface),
    dropAllTables: queryInterface.dropAllTables.bind(queryInterface),
    createTable: queryInterface.createTable.bind(queryInterface),
    addColumn: queryInterface.addColumn.bind(queryInterface),
    removeColumn: queryInterface.removeColumn.bind(queryInterface),
    changeColumn: queryInterface.changeColumn.bind(queryInterface),
    renameColumn: queryInterface.renameColumn.bind(queryInterface),
    addIndex: queryInterface.addIndex.bind(queryInterface),
    removeIndex: queryInterface.removeIndex.bind(queryInterface),
    addConstraint: queryInterface.addConstraint.bind(queryInterface),
    removeConstraint: queryInterface.removeConstraint.bind(queryInterface),
    describeTable: queryInterface.describeTable.bind(queryInterface),
    // Add any other methods needed
  };
}

// Function to ensure SequelizeMeta table exists
async function createMigrationTable() {
  try {
    const tables = await sequelize.getQueryInterface().showAllTables();
    if (!tables.includes('SequelizeMeta')) {
      console.log('Creating SequelizeMeta table to track migrations');
      await sequelize.getQueryInterface().createTable('SequelizeMeta', {
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          primaryKey: true
        }
      });
      console.log('SequelizeMeta table created successfully');
    } else {
      console.log('SequelizeMeta table already exists');
    }
  } catch (error) {
    console.error('Error creating SequelizeMeta table:', error);
    throw error;
  }
}

// Function to get completed migrations
async function getCompletedMigrations() {
  try {
    const [results] = await sequelize.query('SELECT name FROM SequelizeMeta');
    return results.map(row => row.name);
  } catch (error) {
    console.error('Error getting completed migrations:', error);
    return [];
  }
}

// Function to record a migration as completed
async function recordMigration(name) {
  try {
    await sequelize.query('INSERT INTO SequelizeMeta (name) VALUES (?)', {
      replacements: [name],
      type: QueryTypes.INSERT
    });
    console.log(`Recorded migration in SequelizeMeta: ${name}`);
  } catch (error) {
    console.error(`Error recording migration ${name}:`, error);
    throw error;
  }
}

// Run the migrations
runMigrations(); 