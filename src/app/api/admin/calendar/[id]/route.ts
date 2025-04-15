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

// PUT - Update a calendar configuration
export async function PUT(
  request: NextRequest,
  context: any
) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    const id = context.params.id;
    const data = await request.json();
    const { calendar_id, calendar_name, leave_type, is_active } = data;
    
    if (!calendar_id || !calendar_name || !leave_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if configuration exists
    const existingConfig = await query(
      `SELECT * FROM google_calendar_configs WHERE id = $1`,
      [id]
    );
    
    if (existingConfig.rows.length === 0) {
      return NextResponse.json(
        { error: 'Calendar configuration not found' },
        { status: 404 }
      );
    }
    
    // Check if updated configuration would conflict with another existing configuration
    const conflictCheck = await query(
      `SELECT * FROM google_calendar_configs 
       WHERE leave_type = $1 AND calendar_id = $2 AND id != $3`,
      [leave_type, calendar_id, id]
    );
    
    if (conflictCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'A configuration for this leave type and calendar ID already exists' },
        { status: 409 }
      );
    }
    
    // Update configuration
    const result = await query(
      `UPDATE google_calendar_configs 
       SET calendar_id = $1, calendar_name = $2, leave_type = $3, is_active = $4, updated_at = NOW() 
       WHERE id = $5 
       RETURNING *`,
      [calendar_id, calendar_name, leave_type, is_active, id]
    );
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating calendar configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update calendar configuration' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a calendar configuration
export async function DELETE(
  request: NextRequest,
  context: any
) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    const id = context.params.id;
    
    // Check if configuration exists
    const existingConfig = await query(
      `SELECT * FROM google_calendar_configs WHERE id = $1`,
      [id]
    );
    
    if (existingConfig.rows.length === 0) {
      return NextResponse.json(
        { error: 'Calendar configuration not found' },
        { status: 404 }
      );
    }
    
    // Delete configuration
    await query(
      `DELETE FROM google_calendar_configs WHERE id = $1`,
      [id]
    );
    
    return NextResponse.json(
      { message: 'Calendar configuration deleted successfully' }
    );
  } catch (error) {
    console.error('Error deleting calendar configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete calendar configuration' },
      { status: 500 }
    );
  }
}
