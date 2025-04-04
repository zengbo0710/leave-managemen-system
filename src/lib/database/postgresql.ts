import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a PostgreSQL connection pool with better configuration handling
export const pool = (() => {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  // Log connection details for debugging (redacting password)
  console.log('PostgreSQL connection config:', {
    using_connection_string: !!DATABASE_URL,
    host: process.env.DB_HOST || 'from_connection_string',
    database: process.env.DB_NAME || 'from_connection_string',
    user: process.env.DB_USER || 'from_connection_string',
    port: process.env.DB_PORT || 'from_connection_string'
  });
  
  try {
    // If DATABASE_URL is available, use it
    if (DATABASE_URL) {
      console.log('Using DATABASE_URL for PostgreSQL connection');
      return new Pool({ 
        connectionString: DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      });
    }
    
    // Otherwise use individual connection parameters
    console.log('Using individual connection parameters for PostgreSQL');
    return new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT) || 5432,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  } catch (initError) {
    console.error('Error initializing PostgreSQL pool:', initError);
    throw initError;
  }
})();

// Export the query function and other PostgreSQL utilities
export * from '../db-utils';

// Simplified query function
export async function pgQuery(text: string, params?: (string | number | boolean | null)[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
