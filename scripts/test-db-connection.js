// Simple script to test database connection
require('dotenv').config();
const { Pool } = require('pg');

console.log('=== Database Configuration Test ===');
console.log('Checking environment variables:');

// Log connection parameters (hiding password)
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
console.log(`DB_HOST: ${process.env.DB_HOST || '❌ Not set'}`);
console.log(`DB_NAME: ${process.env.DB_NAME || '❌ Not set'}`);
console.log(`DB_USER: ${process.env.DB_USER || '❌ Not set'}`);
console.log(`DB_PORT: ${process.env.DB_PORT || '❌ Not set'}`);
console.log(`DB_PASSWORD: ${process.env.DB_PASSWORD ? '✅ Set' : '❌ Not set'}`);
console.log(`DB_SSL: ${process.env.DB_SSL || '❌ Not set'}`);

// Determine connection config
let connectionConfig;
if (process.env.DATABASE_URL) {
  console.log('\nUsing DATABASE_URL for connection');
  connectionConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  };
} else {
  console.log('\nUsing individual connection parameters');
  connectionConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  };
}

console.log('\nAttempting to connect to database...');
const pool = new Pool({
  ...connectionConfig,
  connectionTimeoutMillis: 5000,
});

// Test the connection
async function testConnection() {
  let client;
  try {
    console.log('Connecting to PostgreSQL...');
    client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL!');
    
    const result = await client.query('SELECT NOW() as current_time');
    console.log(`✅ Database time: ${result.rows[0].current_time}`);
    
    console.log('Testing query on users table...');
    try {
      const usersResult = await client.query('SELECT COUNT(*) FROM users');
      console.log(`✅ Users table exists with ${usersResult.rows[0].count} records`);
    } catch (tableError) {
      console.error(`❌ Error querying users table: ${tableError.message}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Connection error: ${error.message}`);
    console.error(`Error code: ${error.code}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nTROUBLESHOOTING TIPS:');
      console.error('1. Check if your database server is running');
      console.error('2. Verify the host and port are correct');
      console.error('3. Ensure network access to the database is allowed');
    }
    
    return false;
  } finally {
    if (client) {
      client.release();
      console.log('Client connection released');
    }
    await pool.end();
    console.log('Connection pool closed');
  }
}

testConnection();
