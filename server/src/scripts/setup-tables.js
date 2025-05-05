'use strict';

/**
 * Script to setup all database tables directly using SQL script
 * 
 * This script directly executes the SQL in db-setup.sql to create
 * all necessary tables, bypassing Sequelize migrations.
 * 
 * Usage: node src/scripts/setup-tables.js
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');

// Log formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

console.log(`${colors.blue}==== Database Tables Setup Tool ====${colors.reset}\n`);

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment variables from: ${colors.cyan}${envPath}${colors.reset}`);
  dotenv.config({ path: envPath });
} else {
  console.log(`${colors.yellow}No .env file found, using default environment variables${colors.reset}`);
  dotenv.config();
}

// SQL file path
const sqlFilePath = path.resolve(__dirname, './db-setup.sql');

if (!fs.existsSync(sqlFilePath)) {
  console.error(`${colors.red}SQL file not found at: ${sqlFilePath}${colors.reset}`);
  process.exit(1);
}

// Get DB connection info
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || '3306';

console.log(`\nDatabase connection information:`);
console.log(`- Host: ${colors.cyan}${dbHost}:${dbPort}${colors.reset}`);
console.log(`- User: ${colors.cyan}${dbUser}${colors.reset}`);

// Prompt for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question(`\n${colors.yellow}This will create/modify database tables. Continue? (y/N)${colors.reset} `, (answer) => {
  if (answer.toLowerCase() === 'y') {
    runSqlFile();
  } else {
    console.log(`${colors.yellow}Operation cancelled${colors.reset}`);
    rl.close();
    process.exit(0);
  }
});

/**
 * Run the SQL file using mysql command
 */
function runSqlFile() {
  console.log(`\n${colors.blue}Executing SQL file: ${sqlFilePath}${colors.reset}`);
  
  // Build mysql command
  let command = '';
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  
  if (process.platform === 'win32') {
    // For Windows - write to temp file and use < redirection
    const tempScriptPath = path.resolve(__dirname, 'temp_script.sql');
    fs.writeFileSync(tempScriptPath, sqlContent);
    
    // Use CMD shell on Windows
    command = `mysql -u "${dbUser}" ${dbPassword ? `-p"${dbPassword}"` : ''} -h "${dbHost}" ${dbPort !== '3306' ? `-P ${dbPort}` : ''} < "${tempScriptPath}"`;
    console.log(`${colors.yellow}Command:${colors.reset} ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      // Clean up temp file
      try { fs.unlinkSync(tempScriptPath); } catch (e) { }
      
      if (error) {
        console.error(`${colors.red}Error executing SQL:${colors.reset}`, error.message);
        console.error(`${colors.red}Details:${colors.reset}`, stderr);
        
        // Offer manual steps
        console.log(`\n${colors.yellow}Try manually:${colors.reset}`);
        console.log(`1. Open MySQL client: mysql -u ${dbUser} ${dbPassword ? '-p' : ''}`);
        console.log(`2. Run the SQL commands from: ${sqlFilePath}`);
        
        rl.close();
        process.exit(1);
      } else {
        console.log(`${colors.green}SQL executed successfully!${colors.reset}`);
        console.log(`${colors.green}All database tables are now set up.${colors.reset}`);
        
        if (stdout) {
          console.log(`\nOutput:\n${stdout}`);
        }
        
        rl.close();
        process.exit(0);
      }
    });
  } else {
    // For Unix systems
    if (dbPassword) {
      // With password (using environment variable to avoid showing in process list)
      process.env.MYSQL_PWD = dbPassword;
      command = `mysql -u "${dbUser}" -h "${dbHost}" ${dbPort !== '3306' ? `-P ${dbPort}` : ''} -e "${sqlContent.replace(/\"/g, '\\"')}"`;
    } else {
      // Without password
      command = `mysql -u "${dbUser}" -h "${dbHost}" ${dbPort !== '3306' ? `-P ${dbPort}` : ''} -e "${sqlContent.replace(/\"/g, '\\"')}"`;
    }
    
    console.log(`${colors.yellow}Executing SQL with mysql client...${colors.reset}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`${colors.red}Error executing SQL:${colors.reset}`, error.message);
        console.error(`${colors.red}Details:${colors.reset}`, stderr);
        
        // Offer manual steps
        console.log(`\n${colors.yellow}Try manually:${colors.reset}`);
        console.log(`1. Open MySQL client: mysql -u ${dbUser} ${dbPassword ? '-p' : ''}`);
        console.log(`2. Run the SQL commands from: ${sqlFilePath}`);
        
        rl.close();
        process.exit(1);
      } else {
        console.log(`${colors.green}SQL executed successfully!${colors.reset}`);
        console.log(`${colors.green}All database tables are now set up.${colors.reset}`);
        
        if (stdout) {
          console.log(`\nOutput:\n${stdout}`);
        }
        
        rl.close();
        process.exit(0);
      }
    });
  }
}

// Handle keyboard interrupt
rl.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Operation cancelled by user${colors.reset}`);
  rl.close();
  process.exit(0);
}); 