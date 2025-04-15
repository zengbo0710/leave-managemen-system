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

// POST - Save OAuth tokens
export async function POST(request: NextRequest) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    const data = await request.json();
    const { access_token, refresh_token, expiry_date } = data;
    
    if (!access_token || !refresh_token || !expiry_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // First create the table if it doesn't exist
    try {
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
    } catch (tableError) {
      console.error('Error creating/checking oauth tokens table:', tableError);
      // Continue anyway, table might already exist
    }
    
    // Check if token already exists for this admin
    const existingToken = await query(
      `SELECT * FROM google_oauth_tokens WHERE user_id = $1`,
      [adminCheck.userId]
    );
    
    const expiryTimestamp = new Date(expiry_date);
    
    if (existingToken.rows.length > 0) {
      // Update existing token
      await query(
        `UPDATE google_oauth_tokens 
         SET access_token = $1, refresh_token = $2, expiry_date = $3, updated_at = NOW() 
         WHERE user_id = $4`,
        [access_token, refresh_token, expiryTimestamp, adminCheck.userId]
      );
    } else {
      // Create new token
      await query(
        `INSERT INTO google_oauth_tokens 
         (user_id, access_token, refresh_token, expiry_date) 
         VALUES ($1, $2, $3, $4)`,
        [adminCheck.userId, access_token, refresh_token, expiryTimestamp]
      );
    }
    
    return NextResponse.json({ 
      message: 'OAuth tokens saved successfully',
      connected: true
    });
  } catch (error) {
    console.error('Error saving OAuth tokens:', error);
    return NextResponse.json(
      { error: 'Failed to save OAuth tokens' },
      { status: 500 }
    );
  }
}

// GET - Check if OAuth tokens exist for the current admin
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    // Check if table exists
    try {
      const tableCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'google_oauth_tokens'
        )
      `, []);
      
      if (!tableCheck.rows[0].exists) {
        return NextResponse.json({ connected: false, message: 'OAuth tokens table does not exist' });
      }
    } catch (tableError) {
      console.error('Error checking if oauth tokens table exists:', tableError);
      return NextResponse.json({ connected: false, error: 'Error checking OAuth tokens table' });
    }
    
    // Check if tokens exist for this admin
    const tokens = await query(
      `SELECT id, user_id, created_at, updated_at, expiry_date FROM google_oauth_tokens WHERE user_id = $1`,
      [adminCheck.userId]
    );
    
    if (tokens.rows.length === 0) {
      return NextResponse.json({ connected: false });
    }
    
    // Check if token is expired
    const tokenData = tokens.rows[0];
    const now = new Date();
    const expiry = new Date(tokenData.expiry_date);
    
    if (expiry < now) {
      return NextResponse.json({ 
        connected: true, 
        status: 'expired',
        expiry: expiry.toISOString()
      });
    }
    
    return NextResponse.json({ 
      connected: true,
      status: 'valid',
      expiry: expiry.toISOString()
    });
  } catch (error) {
    console.error('Error checking OAuth tokens:', error);
    return NextResponse.json(
      { connected: false, error: 'Failed to check OAuth tokens' },
      { status: 500 }
    );
  }
}

// DELETE - Remove OAuth tokens for the current admin
export async function DELETE(request: NextRequest) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    await query(
      `DELETE FROM google_oauth_tokens WHERE user_id = $1`,
      [adminCheck.userId]
    );
    
    return NextResponse.json({ 
      message: 'OAuth tokens deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting OAuth tokens:', error);
    return NextResponse.json(
      { error: 'Failed to delete OAuth tokens' },
      { status: 500 }
    );
  }
}
