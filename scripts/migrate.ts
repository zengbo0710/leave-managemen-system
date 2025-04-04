import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_OjPk20aDJstd@ep-proud-frost-a1bx9pnf-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

// For migrations
const migrationClient = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(migrationClient);

async function main() {
  console.log('Running migrations...');
  
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

main();
