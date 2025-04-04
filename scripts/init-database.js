// Database initialization script for Leave Management System
require('dotenv').config();
const { Pool } = require('pg');
const { hash } = require('bcryptjs');

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Database schema and initial data setup
async function initDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database initialization...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Create users table
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        department VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create leaves table
    console.log('Creating leaves table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        leave_type VARCHAR(50) NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        is_half_day BOOLEAN DEFAULT false,
        period VARCHAR(20),
        approved_by INTEGER REFERENCES users(id),
        slack_notification_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create slack_config table
    console.log('Creating slack_config table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS slack_config (
        id SERIAL PRIMARY KEY,
        bot_token VARCHAR(255),
        channel_id VARCHAR(50),
        enabled BOOLEAN DEFAULT true,
        day_range INTEGER DEFAULT 3,
        schedule_enabled BOOLEAN DEFAULT true,
        schedule_time VARCHAR(10) DEFAULT '08:30',
        schedule_workdays_only BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if admin user exists
    const adminExists = await client.query(`
      SELECT COUNT(*) FROM users WHERE email = 'admin@example.com'
    `);
    
    // Create default admin user if it doesn't exist
    if (parseInt(adminExists.rows[0].count) === 0) {
      console.log('Creating default admin user...');
      const hashedPassword = await hash('admin123', 10);
      await client.query(`
        INSERT INTO users (name, email, password, role, department)
        VALUES ('Admin User', 'admin@example.com', $1, 'admin', 'Management')
      `, [hashedPassword]);
    }
    
    // Create default slack config if it doesn't exist
    const slackConfigExists = await client.query(`
      SELECT COUNT(*) FROM slack_config
    `);
    
    if (parseInt(slackConfigExists.rows[0].count) === 0) {
      console.log('Creating default slack config...');
      await client.query(`
        INSERT INTO slack_config (bot_token, channel_id, enabled)
        VALUES ('', 'general', true)
      `);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Database initialization completed successfully!');
    console.log('\nDefault admin credentials:');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');
    console.log('\nPlease change these credentials in production!');
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run initialization
initDatabase().catch(err => {
  console.error('Fatal error during database initialization:', err);
  process.exit(1);
});
