import { testConnection, createTables, seedDatabase } from '../src/lib/db-utils';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupDatabase() {
  try {
    console.log('Starting database setup...');
    
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('Failed to connect to database. Please check your connection string.');
      process.exit(1);
    }
    
    // Create database tables
    console.log('Creating database tables...');
    await createTables();
    
    // Seed database with initial data
    console.log('Seeding database with initial data...');
    await seedDatabase();
    
    console.log('Database setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during database setup:', error);
    process.exit(1);
  }
}

// Run the setup function
setupDatabase();
