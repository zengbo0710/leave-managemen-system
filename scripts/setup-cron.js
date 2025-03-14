#!/usr/bin/env node

/**
 * This script sets up a cron job to regularly check if it's time to send Slack notifications
 * according to the schedule configured in the database.
 * 
 * To use this script:
 * 1. Make it executable: chmod +x scripts/setup-cron.js
 * 2. Run it once to set up the cron job: npm run setup-cron
 * 
 * Requires: node-cron, node-fetch, and dotenv
 */

const cron = require('node-cron');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Default check interval (every 5 minutes)
const CHECK_INTERVAL = process.env.SLACK_CHECK_INTERVAL || '*/5 * * * *';

// Get the base URL from environment, or default to localhost:3000
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Generate a random secret token if not set
const CRON_SECRET_TOKEN = process.env.CRON_SECRET_TOKEN || 
  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Update .env file with the token if not already set
if (!process.env.CRON_SECRET_TOKEN) {
  try {
    const envFilePath = path.resolve(process.cwd(), '.env');
    let envContent = '';
    
    // Read existing .env content if file exists
    if (fs.existsSync(envFilePath)) {
      envContent = fs.readFileSync(envFilePath, 'utf8');
    }
    
    // Only add token if not already in .env
    if (!envContent.includes('CRON_SECRET_TOKEN=')) {
      fs.appendFileSync(
        envFilePath, 
        `\n# Secret token for cron jobs\nCRON_SECRET_TOKEN=${CRON_SECRET_TOKEN}\n`
      );
      console.log('Added CRON_SECRET_TOKEN to .env file');
    }
  } catch (error) {
    console.error('Error updating .env file:', error);
  }
}

// Function to check if it's time to send a notification
async function checkAndSendNotification() {
  try {
    console.log(`[${new Date().toISOString()}] Checking if it's time to send Slack notifications...`);
    
    // Construct the URL with the secret token
    const url = `${BASE_URL}/api/cron/slack-notify?token=${CRON_SECRET_TOKEN}`;
    
    // Make request to the API endpoint
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`[${new Date().toISOString()}] Response:`, data);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error checking notifications:`, error);
  }
}

// Set up the cron job to run at the specified interval
console.log(`Setting up cron job to check for Slack notifications every 5 minutes...`);
cron.schedule(CHECK_INTERVAL, checkAndSendNotification);

// Run once immediately
checkAndSendNotification();

console.log('Cron job is now running. Keep this process running in the background.');
console.log('Press Ctrl+C to stop the cron job.');

// Keep the script running
process.stdin.resume();

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('Cron job stopped');
  process.exit();
});
