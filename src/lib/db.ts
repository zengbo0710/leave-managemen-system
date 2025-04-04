import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// PostgreSQL connection string
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dd7orv:xau_twGqvVMEBinLjYrZd8df7vNzrv3qNb7i4@us-east-1.sql.xata.sh/lms-db:main?sslmode=require';

if (!DATABASE_URL) {
  throw new Error('Please define the DATABASE_URL environment variable');
}

// Create SQL client
const client = postgres(DATABASE_URL, { max: 1 });

// Create the database interface with Drizzle
export const db = drizzle(client, { schema });

// For backwards compatibility with existing code
export async function connectToDatabase() {
  return { connection: db };
}
