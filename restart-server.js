const { exec } = require('child_process');
const path = require('path');

console.log('Restarting server with migrations...');

// Change to server directory
const serverDir = path.join(__dirname, 'server');
process.chdir(serverDir);

// Run the server with migrations
const serverProcess = exec('npm run dev', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }
  
  console.log(`stdout: ${stdout}`);
});

serverProcess.stdout.on('data', (data) => {
  console.log(data);
});

serverProcess.stderr.on('data', (data) => {
  console.error(data);
}); 