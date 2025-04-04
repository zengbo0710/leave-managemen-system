// Script to verify and print the database configuration
require('dotenv').config();
const { Pool } = require('pg');

console.log('Checking database configuration...');

// Log the database configuration
const connectionString = process.env.DATABASE_URL;
console.log('DATABASE_URL:', connectionString ? connectionString.replace(/\/\/.*?:.*?@/, '//[USER]:[PASSWORD]@') : 'Not set');

console.log('\nIndividual connection parameters:');
console.log('DB_USER:', process.env.DB_USER || 'Not set');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '******' : 'Not set');
console.log('DB_HOST:', process.env.DB_HOST || 'Not set');
console.log('DB_PORT:', process.env.DB_PORT || 'Not set');
console.log('DB_NAME:', process.env.DB_NAME || 'Not set');
console.log('DB_SSL:', process.env.DB_SSL || 'Not set');

// Create a test connection pool using the same logic as the application
let pool;
if (connectionString) {
  console.log('\nUsing connection string for database connection');
  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  console.log('\nUsing individual parameters for database connection');
  pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });
}

async function testConnection() {
  let client;
  try {
    console.log('\nTesting database connection...');
    client = await pool.connect();
    
    // Explicitly set search path to public schema
    console.log('Setting search_path to public schema');
    await client.query('SET search_path TO public');
    
    // Check if tables exist
    console.log('Checking for users table...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`\nFound ${tablesResult.rows.length} tables in public schema:`);
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Try to query the users table directly
    console.log('\nAttempting to query users table...');
    try {
      const usersResult = await client.query('SELECT COUNT(*) FROM public.users');
      console.log(`Found ${usersResult.rows[0].count} users in the database`);
    } catch (tableError) {
      console.error('Error querying users table:', tableError.message);
    }
    
    // Try to query the admin user directly
    console.log('\nAttempting to query admin user...');
    try {
      const adminResult = await client.query("SELECT * FROM public.users WHERE email = 'admin@example.com'");
      if (adminResult.rows.length > 0) {
        console.log('✅ Admin user found with ID:', adminResult.rows[0].id);
      } else {
        console.log('❌ Admin user not found');
      }
    } catch (adminError) {
      console.error('Error querying admin user:', adminError.message);
    }
    
    client.release();
    console.log('\n✅ Database connection test completed');
    
  } catch (error) {
    console.error('\n❌ Database connection error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (client) {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

testConnection().catch(console.error);
