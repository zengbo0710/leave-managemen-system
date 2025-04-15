import { NextResponse } from 'next/server';
import { query } from '@/lib/db-utils';

// POST - Create the required tables for Google Calendar integration
export async function GET() {
  try {
    // Create tables for Google Calendar integration
    
    // 1. Create table for Google OAuth tokens
    await query(`
      CREATE TABLE IF NOT EXISTS google_oauth_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expiry_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `, []);
    
    // 2. Create table for Google Calendar configurations
    await query(`
      CREATE TABLE IF NOT EXISTS google_calendar_configs (
        id SERIAL PRIMARY KEY,
        calendar_id TEXT NOT NULL,
        calendar_name TEXT NOT NULL,
        leave_type TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(leave_type, calendar_id)
      )
    `, []);
    
    // 3. Create table for tracking Google Calendar event synchronization
    await query(`
      CREATE TABLE IF NOT EXISTS google_calendar_events (
        id SERIAL PRIMARY KEY,
        leave_id INTEGER NOT NULL REFERENCES leaves(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL,
        calendar_id TEXT NOT NULL,
        last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(leave_id, calendar_id)
      )
    `, []);
    
    return NextResponse.json({ 
      success: true,
      message: 'Google Calendar integration tables created successfully' 
    });
  } catch (error) {
    console.error('Error creating Google Calendar tables:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create Google Calendar integration tables',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
