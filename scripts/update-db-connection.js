// Script to update the database connection in the .env file
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const envFilePath = path.resolve(process.cwd(), '.env');
const newDbUrl = 'postgresql://neondb_owner:npg_OjPk20aDJstd@ep-proud-frost-a1bx9pnf-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

console.log('Updating database connection...');
console.log(`Setting DATABASE_URL to: ${newDbUrl.replace(/\/\/.*?:.*?@/, '//[USER]:[PASSWORD]@')}`);

// Read the current .env file
let envContent = '';
try {
  envContent = fs.readFileSync(envFilePath, 'utf8');
  console.log('Found existing .env file');
} catch (error) {
  console.log('No existing .env file, creating new one');
}

// Update or add the DATABASE_URL
if (envContent.includes('DATABASE_URL=')) {
  // Replace existing DATABASE_URL
  envContent = envContent.replace(/DATABASE_URL=.*(\r?\n|$)/g, `DATABASE_URL=${newDbUrl}$1`);
} else {
  // Add DATABASE_URL if it doesn't exist
  envContent += `\nDATABASE_URL=${newDbUrl}\n`;
}

// Write the updated content back to the .env file
fs.writeFileSync(envFilePath, envContent);

console.log('✅ Database connection updated successfully in .env file');
console.log('Restart the application to apply the changes');
