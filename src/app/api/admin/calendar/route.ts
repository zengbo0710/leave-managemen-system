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

// GET - Get all calendar configurations
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    const result = await query(
      `SELECT * FROM google_calendar_configs ORDER BY created_at DESC`,
      []
    );
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching calendar configurations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar configurations' },
      { status: 500 }
    );
  }
}

// POST - Create a new calendar configuration
export async function POST(request: NextRequest) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    const data = await request.json();
    const { calendar_id, calendar_name, leave_type, is_active } = data;
    
    if (!calendar_id || !calendar_name || !leave_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if calendar configuration already exists for this leave type
    const existingConfig = await query(
      `SELECT * FROM google_calendar_configs 
       WHERE leave_type = $1 AND calendar_id = $2`,
      [leave_type, calendar_id]
    );
    
    if (existingConfig.rows.length > 0) {
      return NextResponse.json(
        { error: 'A configuration for this leave type and calendar ID already exists' },
        { status: 409 }
      );
    }
    
    // Create new configuration
    const result = await query(
      `INSERT INTO google_calendar_configs 
       (calendar_id, calendar_name, leave_type, is_active, created_by) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [calendar_id, calendar_name, leave_type, is_active, adminCheck.userId]
    );
    
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating calendar configuration:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar configuration' },
      { status: 500 }
    );
  }
}
