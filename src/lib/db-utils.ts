import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a PostgreSQL connection pool with better configuration handling
export const pool = (() => {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  // Log connection details for debugging (redacting password)
  console.log('Database connection config:', {
    using_connection_string: !!DATABASE_URL,
    host: process.env.DB_HOST || 'from_connection_string',
    database: process.env.DB_NAME || 'from_connection_string',
    user: process.env.DB_USER || 'from_connection_string',
    port: process.env.DB_PORT || 'from_connection_string'
  });
  
  try {
    // Common connection options for both methods
    const connectionOptions = {
      connectionTimeoutMillis: 5000, // 5 seconds timeout
      idleTimeoutMillis: 30000,      // 30 seconds idle timeout
      max: 10                        // Maximum connections in pool
    };
    
    // If DATABASE_URL is available, use it
    if (DATABASE_URL) {
      console.log('Using DATABASE_URL for connection');
      return new Pool({ 
        connectionString: DATABASE_URL,
        ...connectionOptions
      });
    }
    
    // Otherwise use individual connection parameters
    console.log('Using individual connection parameters');
    return new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT) || 5432,
      // Add SSL configuration if needed
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      ...connectionOptions
    });
  } catch (initError) {
    console.error('Error initializing database pool:', initError);
    throw initError;
  }
})();

// Register event handlers for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Check if database is actually accessible
export async function isDatabaseAccessible() {
  try {
    const { Client } = require('pg');
    const config = pool.options;
    
    // Create a single client for testing connection
    const client = new Client({
      ...config,
      connectionTimeoutMillis: 3000, // Short timeout for connection test
    });
    
    await client.connect();
    await client.end();
    return true;
  } catch (error) {
    console.error('Database not accessible:', error.message);
    return false;
  }
}

// Test database connection with better error reporting
export async function testConnection() {
  let client;
  
  try {
    client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log('Successfully connected to PostgreSQL database', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Error connecting to PostgreSQL database:', error);
    
    // Provide more detailed error information
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused. Check if your database server is running and accessible.');
    } else if (error.code === 'ENOTFOUND') {
      console.error('Host not found. Check your DB_HOST or DATABASE_URL setting.');
    } else if (error.code === '28P01') {
      console.error('Authentication failed. Check your database username and password.');
    } else if (error.code === '3D000') {
      console.error('Database does not exist. Check your DB_NAME setting.');
    }
    
    return false;
  } finally {
    if (client) client.release();
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

// Configuration for connection retries
const MAX_RETRIES = 5;       // Increased from 3
const RETRY_DELAY = 2000;    // Increased to 2 seconds

// Run a query and return results
export async function query(text: string, params?: any[]) {
  let retries = 0;
  
  // Check database accessibility first
  const isAccessible = await isDatabaseAccessible();
  if (!isAccessible) {
    console.error('Database server is not accessible. Check your database connection settings and ensure the database server is running.');
  }
  
  while (true) {
    try {
      const client = await pool.connect();
      try {
        const res = await client.query(text, params);
        return res;
      } finally {
        client.release();
      }
    } catch (error: any) {
      retries++;
      console.error(`Database connection error (attempt ${retries}/${MAX_RETRIES}):`, {
        error: error.message,
        code: error.code,
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        params: params ? JSON.stringify(params).substring(0, 100) : 'none'
      });
      
      if (error.code === 'ECONNREFUSED') {
        console.error('Connection refused. Check if your database server is running at the specified host and port.');
      } else if (error.code === 'ETIMEDOUT') {
        console.error('Connection timed out. Database server may be slow or unreachable.');
      }
      
      if (retries >= MAX_RETRIES || (error.code !== 'ECONNREFUSED' && error.code !== 'ETIMEDOUT')) {
        console.error('Database operation failed after maximum retry attempts or encountered a non-connection error');
        throw error;
      }
      
      console.log(`Retrying database connection in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

// Specific function to check database connection for login page
export async function checkLoginDatabaseConnection() {
  console.log('Checking database connection for login page...');
  
  try {
    // First check if database is accessible at all
    const isAccessible = await isDatabaseAccessible();
    
    if (!isAccessible) {
      console.error('Database is not accessible for login. Please check your database server.');
      return {
        success: false,
        message: 'Database connection failed. Please contact system administrator.',
        details: 'Database server is not accessible'
      };
    }
    
    // Then check if we can query the users table specifically
    const client = await pool.connect();
    try {
      // Just check if the users table exists and is accessible
      await client.query('SELECT COUNT(*) FROM users LIMIT 1');
      
      console.log('Login database connection check: SUCCESS');
      return {
        success: true,
        message: 'Database connection successful'
      };
    } catch (error: any) {
      console.error('Login database table check failed:', error.message);
      
      // Handle specific errors that might occur during login
      if (error.code === '42P01') { // undefined_table
        return {
          success: false,
          message: 'Database schema issue. Please run database setup.',
          details: 'The users table does not exist'
        };
      }
      
      return {
        success: false,
        message: 'Database error. Please contact system administrator.',
        details: error.message
      };
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Login database connection check failed with exception:', error);
    return {
      success: false,
      message: 'Unable to verify database connection.',
      details: error.message
    };
  }
}
