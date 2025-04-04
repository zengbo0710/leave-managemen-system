// Test script for Xata PostgreSQL connection
const { Pool } = require('pg');

// Use the connection string directly for testing
const DATABASE_URL = 'postgresql://dd7orv:xau_twGqvVMEBinLjYrZd8df7vNzrv3qNb7i4@us-east-1.sql.xata.sh/lms-db:main?sslmode=require';

console.log('Testing connection to Xata PostgreSQL database...');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // May be needed for some PostgreSQL providers
  },
  connectionTimeoutMillis: 10000 // 10 seconds timeout
});

async function testConnection() {
  let client;
  try {
    console.log('Connecting to Xata PostgreSQL...');
    client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL!');
    
    const result = await client.query('SELECT NOW() as current_time');
    console.log(`✅ Database time: ${result.rows[0].current_time}`);
    
    // Try to check if users table exists
    try {
      console.log('Checking for users table...');
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      console.log('Available tables:');
      tablesResult.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
      
      return true;
    } catch (tableError) {
      console.error(`Error checking tables: ${tableError.message}`);
    }
  } catch (error) {
    console.error(`❌ Connection error: ${error.message}`);
    console.error(`Error code: ${error.code}`);
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
