'use strict';

/**
 * Script to fix npm cache permissions issues on server
 * 
 * This is often needed in shared hosting environments like BaoTa Panel
 * where npm cache directory might be owned by root but used by another user
 * 
 * Usage: node src/scripts/fix-permissions.js
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Log formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

console.log(`${colors.blue}==== NPM Permissions Fix Tool ====${colors.reset}`);
console.log('Running permission checks and fixes for npm cache...');

// Detect user info
const currentUser = os.userInfo();
console.log(`Current user: ${colors.yellow}${currentUser.username} (uid: ${currentUser.uid})${colors.reset}`);

// Detect npm config
exec('npm config get cache', (error, stdout, stderr) => {
  if (error) {
    console.error(`${colors.red}Error getting npm cache location:${colors.reset}`, error);
    return;
  }
  
  const npmCachePath = stdout.trim();
  console.log(`NPM cache path: ${colors.yellow}${npmCachePath}${colors.reset}`);
  
  // Check if the directory exists
  if (!fs.existsSync(npmCachePath)) {
    console.log(`${colors.yellow}Cache directory doesn't exist, creating it...${colors.reset}`);
    try {
      fs.mkdirSync(npmCachePath, { recursive: true });
      console.log(`${colors.green}Cache directory created${colors.reset}`);
    } catch (err) {
      console.error(`${colors.red}Failed to create cache directory:${colors.reset}`, err);
      console.log(`\n${colors.yellow}Try running manually:${colors.reset}`);
      console.log(`mkdir -p ${npmCachePath}`);
      return;
    }
  }
  
  // Check directory permissions
  fs.stat(npmCachePath, (err, stats) => {
    if (err) {
      console.error(`${colors.red}Error checking directory permissions:${colors.reset}`, err);
      return;
    }
    
    console.log(`Current directory owner: ${colors.yellow}${stats.uid}${colors.reset} (Current user: ${currentUser.uid})`);
    
    if (stats.uid !== currentUser.uid) {
      console.log(`${colors.yellow}Directory is owned by another user, attempting to fix...${colors.reset}`);
      
      // First try to change ownership recursively
      const chownCommand = getChownCommand(npmCachePath, currentUser.uid);
      console.log(`Running: ${colors.blue}${chownCommand}${colors.reset}`);
      
      exec(chownCommand, (chownErr, chownStdout, chownStderr) => {
        if (chownErr) {
          console.error(`${colors.red}Failed to change ownership:${colors.reset}`, chownErr);
          console.log(`\n${colors.yellow}Root privileges required. Try running:${colors.reset}`);
          console.log(`sudo ${chownCommand}`);
          
          // If chown fails, try a workaround with npm cache clean
          console.log(`\n${colors.yellow}Trying alternative approach: clearing npm cache...${colors.reset}`);
          exec('npm cache clean --force', (cleanErr, cleanStdout, cleanStderr) => {
            if (cleanErr) {
              console.error(`${colors.red}Failed to clean npm cache:${colors.reset}`, cleanErr);
            } else {
              console.log(`${colors.green}Successfully cleaned npm cache${colors.reset}`);
              console.log(`${colors.yellow}Recommended: Configure npm to use a different cache directory:${colors.reset}`);
              console.log(`npm config set cache "${path.join(os.homedir(), '.npm-cache')}"`);
            }
          });
        } else {
          console.log(`${colors.green}Successfully changed ownership of npm cache directory${colors.reset}`);
        }
      });
    } else {
      console.log(`${colors.green}Directory permissions look good!${colors.reset}`);
      
      // Check for subdirectories with wrong ownership
      checkSubdirectories(npmCachePath, currentUser.uid);
    }
  });
});

/**
 * Get the appropriate chown command based on platform
 */
function getChownCommand(directory, uid) {
  // On Windows, permissions work differently
  if (process.platform === 'win32') {
    return `icacls "${directory}" /setowner ${os.userInfo().username} /T`;
  }
  
  // Unix-like systems
  return `chown -R ${uid} "${directory}"`;
}

/**
 * Check subdirectories for permission issues
 */
function checkSubdirectories(directory, userId) {
  console.log(`${colors.blue}Checking subdirectories of ${directory}...${colors.reset}`);
  
  try {
    const items = fs.readdirSync(directory);
    let problemFound = false;
    
    for (const item of items) {
      const itemPath = path.join(directory, item);
      try {
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory() && stats.uid !== userId) {
          console.log(`${colors.yellow}Permission issue found:${colors.reset} ${itemPath} (owner: ${stats.uid})`);
          problemFound = true;
        }
      } catch (err) {
        console.error(`${colors.red}Error checking ${itemPath}:${colors.reset}`, err);
      }
    }
    
    if (problemFound) {
      console.log(`${colors.yellow}Some subdirectories have incorrect ownership.${colors.reset}`);
      console.log(`${colors.yellow}Recommended: ${colors.reset}npm cache clean --force`);
    } else {
      console.log(`${colors.green}All subdirectories look good!${colors.reset}`);
    }
  } catch (err) {
    console.error(`${colors.red}Error reading directory:${colors.reset}`, err);
  }
} 