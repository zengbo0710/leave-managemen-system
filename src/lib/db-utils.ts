import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection string
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_OjPk20aDJstd@ep-proud-frost-a1bx9pnf-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

// Create a PostgreSQL connection pool
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for some cloud database providers
  },
});

// Test database connection
export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL database');
    client.release();
    return true;
  } catch (error) {
    console.error('Error connecting to PostgreSQL database:', error);
    return false;
  }
}

// Function to create database tables
export async function createTables() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create roles enum type
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE user_role AS ENUM ('admin', 'employee');
        END IF;
      END $$;
    `);
    
    // Create leave status enum type
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status') THEN
          CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');
        END IF;
      END $$;
    `);
    
    // Create period enum type
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'half_day_period') THEN
          CREATE TYPE half_day_period AS ENUM ('morning', 'afternoon');
        END IF;
      END $$;
    `);
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role user_role NOT NULL DEFAULT 'employee',
        department VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create leave requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        start_date TIMESTAMP WITH TIME ZONE NOT NULL,
        end_date TIMESTAMP WITH TIME ZONE NOT NULL,
        leave_type VARCHAR(100) NOT NULL,
        is_half_day BOOLEAN DEFAULT FALSE,
        period half_day_period,
        reason TEXT,
        status leave_status DEFAULT 'pending',
        approved_by_id INTEGER REFERENCES users(id),
        slack_notification_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create slack configuration table
    await client.query(`
      CREATE TABLE IF NOT EXISTS slack_configs (
        id SERIAL PRIMARY KEY,
        webhook_url VARCHAR(255),
        channel_id VARCHAR(100),
        bot_token VARCHAR(255),
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query('COMMIT');
    console.log('Database tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating database tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Function to seed database with initial data
export async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert admin user
    const adminPasswordHash = '$2a$10$eSEDIjtIqCK2DDmg8Bfj2eke3.IWvONUFiEUPjYSH/iq30C8m99D2'; // bcrypt hash for 'admin123'
    await client.query(`
      INSERT INTO users (name, email, password, role, department)
      VALUES ('Admin User', 'admin@example.com', $1, 'admin', 'Management')
      ON CONFLICT (email) DO NOTHING;
    `, [adminPasswordHash]);
    
    // Insert employee users
    const employeePasswordHash = '$2a$10$8nMdlKw8sE7y.d/qkdY0ieZlSfP1ze2G9Q3IzXtOG03tMNJLHEPbu'; // bcrypt hash for 'employee123'
    await client.query(`
      INSERT INTO users (name, email, password, role, department)
      VALUES 
        ('John Employee', 'john@example.com', $1, 'employee', 'Engineering'),
        ('Sarah Employee', 'sarah@example.com', $1, 'employee', 'HR')
      ON CONFLICT (email) DO NOTHING;
    `, [employeePasswordHash]);
    
    // Get user IDs for sample leave requests
    const adminResult = await client.query(`SELECT id FROM users WHERE email = 'admin@example.com'`);
    const johnResult = await client.query(`SELECT id FROM users WHERE email = 'john@example.com'`);
    const sarahResult = await client.query(`SELECT id FROM users WHERE email = 'sarah@example.com'`);
    
    const adminId = adminResult.rows[0]?.id;
    const johnId = johnResult.rows[0]?.id;
    const sarahId = sarahResult.rows[0]?.id;
    
    if (johnId) {
      // Sample approved leave for John
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      await client.query(`
        INSERT INTO leaves (user_id, start_date, end_date, leave_type, reason, status, approved_by_id)
        VALUES ($1, $2, $3, 'Sick Leave', 'Not feeling well', 'approved', $4);
      `, [johnId, tomorrow, tomorrow, adminId]);
    }
    
    if (sarahId) {
      // Sample pending leave for Sarah
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const nextWeekPlus1 = new Date(nextWeek);
      nextWeekPlus1.setDate(nextWeekPlus1.getDate() + 1);
      
      await client.query(`
        INSERT INTO leaves (user_id, start_date, end_date, leave_type, reason, status)
        VALUES ($1, $2, $3, 'Vacation', 'Family trip', 'pending');
      `, [sarahId, nextWeek, nextWeekPlus1]);
    }
    
    // Insert slack configuration
    await client.query(`
      INSERT INTO slack_configs (webhook_url, channel_id, bot_token, enabled)
      VALUES ('https://hooks.slack.com/services/your-webhook-url', 'general', 'xoxb-your-bot-token', TRUE)
      ON CONFLICT DO NOTHING;
    `);
    
    await client.query('COMMIT');
    console.log('Database seeded successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Helper function to get connection from pool
export async function getConnection() {
  return await pool.connect();
}

// Run a query and return results
export async function query(text: string, params: any[] = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}
