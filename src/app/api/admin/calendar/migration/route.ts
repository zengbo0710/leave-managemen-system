import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-utils';
import jwt from 'jsonwebtoken';

interface CustomJwtPayload {
  id: string;
  email: string;
  role: string;
}

// Helper to verify admin role
const verifyAdminRole = async (request: NextRequest) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isAdmin: false, error: 'Authorization token is required' };
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as CustomJwtPayload;
    if (decoded.role !== 'admin') {
      return { isAdmin: false, error: 'Admin privileges required' };
    }
    return { isAdmin: true, userId: parseInt(decoded.id, 10) };
  } catch (error) {
    return { isAdmin: false, error: 'Invalid token' };
  }
};

// POST - Create required tables for Google Calendar integration
export async function POST(request: NextRequest) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
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
      message: 'Google Calendar integration tables created successfully' 
    });
  } catch (error) {
    console.error('Error creating Google Calendar tables:', error);
    return NextResponse.json(
      { error: 'Failed to create Google Calendar integration tables' },
      { status: 500 }
    );
  }
}
