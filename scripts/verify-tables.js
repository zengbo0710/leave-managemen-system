// Script to verify database tables structure
require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log('Verifying database structure for leave management system...');
console.log(`Connection string: ${connectionString.replace(/\/\/.*?:.*?@/, '//[USER]:[PASSWORD]@')}`);

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function verifyTables() {
  let client;
  try {
    console.log('Connecting to PostgreSQL...');
    client = await pool.connect();
    console.log('✅ Successfully connected to database');
    
    // Get all tables in the database
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('❌ No tables found in the database. Database might be empty.');
      console.log('   You may need to run database migrations or setup scripts.');
      return;
    }
    
    console.log(`\n📋 Found ${tablesResult.rows.length} tables:`);
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Check for expected tables
    const expectedTables = ['users', 'leaves', 'slack_config'];
    const missingTables = expectedTables.filter(table => 
      !tablesResult.rows.some(row => row.table_name === table)
    );
    
    if (missingTables.length > 0) {
      console.log(`\n⚠️ Missing expected tables: ${missingTables.join(', ')}`);
    } else {
      console.log('\n✅ All expected tables are present');
    }
    
    // Check users table structure
    const foundUserTable = tablesResult.rows.some(row => row.table_name === 'users');
    if (foundUserTable) {
      const userColumnsResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Users table structure:');
      userColumnsResult.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
      
      // Try counting users
      try {
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        console.log(`\n👥 Total users: ${userCount.rows[0].count}`);
      } catch (err) {
        console.log(`\n❌ Error counting users: ${err.message}`);
      }
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

verifyTables().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
