// Script to check all available schemas in the PostgreSQL database
require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log('Checking database schemas...');
console.log(`Connection string: ${connectionString.replace(/\/\/.*?:.*?@/, '//[USER]:[PASSWORD]@')}`);

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkSchemas() {
  let client;
  try {
    console.log('Connecting to PostgreSQL...');
    client = await pool.connect();
    console.log('✅ Successfully connected to database');
    
    // Get all schemas in the database
    const schemasResult = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata
      ORDER BY schema_name
    `);
    
    console.log(`\n📋 Found ${schemasResult.rows.length} schemas:`);
    schemasResult.rows.forEach(row => {
      console.log(`   - ${row.schema_name}`);
    });
    
    // Check if the 'main' schema exists
    const mainSchemaExists = schemasResult.rows.some(row => row.schema_name === 'main');
    if (mainSchemaExists) {
      console.log('\n✅ Found "main" schema - this might be where your tables are located');
    }
    
    // Check for tables in all schemas
    console.log('\nLooking for "users" table in all schemas...');
    
    for (const schema of schemasResult.rows) {
      const schemaName = schema.schema_name;
      try {
        // Skip system schemas
        if (['pg_toast', 'pg_temp_1', 'pg_toast_temp_1', 'information_schema'].includes(schemaName)) {
          continue;
        }
        
        const tablesResult = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = $1
          ORDER BY table_name
        `, [schemaName]);
        
        if (tablesResult.rows.length > 0) {
          console.log(`\n📋 Found ${tablesResult.rows.length} tables in schema "${schemaName}":`);
          tablesResult.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
          });
          
          // Check for users table in this schema
          const usersTableExists = tablesResult.rows.some(row => row.table_name === 'users');
          if (usersTableExists) {
            console.log(`\n✅ Found "users" table in schema "${schemaName}"`);
            console.log(`Try querying as: "${schemaName}"."users" or set search_path to include "${schemaName}"`);
          }
        } else {
          console.log(`\nNo tables found in schema "${schemaName}"`);
        }
      } catch (schemaError) {
        console.error(`Error checking schema "${schemaName}":`, schemaError.message);
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

checkSchemas().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
