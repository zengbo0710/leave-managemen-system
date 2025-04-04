// Script to verify the new Neon PostgreSQL connection
require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log('Verifying new database connection...');
console.log(`Connection string: ${connectionString.replace(/\/\/.*?:.*?@/, '//[USER]:[PASSWORD]@')}`);

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function verifyConnection() {
  let client;
  try {
    console.log('Connecting to PostgreSQL...');
    client = await pool.connect();
    console.log('✅ Successfully connected to database');
    
    // Set search path explicitly
    await client.query('SET search_path TO public');
    
    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`\n📋 Found ${tablesResult.rows.length} tables in public schema:`);
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Check for admin user
    const usersResult = await client.query("SELECT * FROM users WHERE email = 'admin@example.com'");
    if (usersResult.rows.length > 0) {
      console.log('\n✅ Admin user exists with details:');
      const user = usersResult.rows[0];
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
    } else {
      console.log('\n❌ Admin user not found');
    }
    
  } catch (error) {
    console.error(`\n❌ Database verification error: ${error.message}`);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

verifyConnection().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
