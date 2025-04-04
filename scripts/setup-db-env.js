#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Default connection string from your input
const defaultConnectionString = 'postgresql://dd7orv:xau_twGqvVMEBinLjYrZd8df7vNzrv3qNb7i4@us-east-1.sql.xata.sh/lms-db:main?sslmode=require';

console.log('Leave Management System - Database Setup');
console.log('----------------------------------------');
console.log('This script will create or update your .env file with the database connection string.');

rl.question(`Enter your PostgreSQL connection string [${defaultConnectionString}]: `, (answer) => {
  const connectionString = answer.trim() || defaultConnectionString;
  
  // Create or update .env file
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  // Check if .env file exists
  if (fs.existsSync(envPath)) {
    // Read existing content
    const existingContent = fs.readFileSync(envPath, 'utf8');
    
    // Check if DATABASE_URL already exists
    if (existingContent.includes('DATABASE_URL=')) {
      // Replace existing DATABASE_URL
      envContent = existingContent.replace(
        /DATABASE_URL=.*/,
        `DATABASE_URL=${connectionString}`
      );
      console.log('Updated existing DATABASE_URL in .env file.');
    } else {
      // Append DATABASE_URL to existing content
      envContent = existingContent + `\n# Database Connection\nDATABASE_URL=${connectionString}\n`;
      console.log('Added DATABASE_URL to existing .env file.');
    }
  } else {
    // Create new .env file
    envContent = `# Environment Variables for Leave Management System
# Created by setup-db-env.js on ${new Date().toISOString()}

# Database Connection
DATABASE_URL=${connectionString}

# JWT Secret (generate a secure random string for production)
JWT_SECRET=leave_management_dev_secret

# Node Environment
NODE_ENV=development
`;
    console.log('Created new .env file with DATABASE_URL.');
  }
  
  // Write the updated content
  fs.writeFileSync(envPath, envContent);
  
  console.log('\nSetup complete! Your database connection string has been saved to .env');
  console.log('You can now start your application with:');
  console.log('  npm run dev');
  
  rl.close();
});
