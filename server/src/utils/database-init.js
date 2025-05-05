// Database initialization script
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting database initialization...');

// 1. Check if .env file exists, if not, create a default one
const envPath = path.join(__dirname, '../../.env');
if (!fs.existsSync(envPath)) {
  console.log('Creating default .env file...');
  
  const defaultEnv = `
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=quiz_app
JWT_SECRET=dev_secret_key
JWT_EXPIRES_IN=30d
ALLOW_PUBLIC_PROGRESS=true
`;
  
  fs.writeFileSync(envPath, defaultEnv.trim());
  console.log('.env file created successfully.');
}

// 2. Display SQL scripts that need to be run manually
console.log('\n=== Required SQL Scripts ===');

// 2.1 Add metadata column to questions table
console.log(`
-- Add metadata column to questions table if it doesn't exist:
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS metadata TEXT 
COMMENT 'JSON metadata for storing additional question information';
`);

// 3. Display next steps
console.log('\n=== Next Steps ===');
console.log('1. Make sure your MySQL server is running');
console.log('2. Update the .env file with your database credentials if needed');
console.log('3. Run database migrations: npx sequelize-cli db:migrate');
console.log('4. Execute the SQL scripts above in your database client if needed');
console.log('5. Start the server: npm run dev');

console.log('\nDatabase initialization completed!'); 