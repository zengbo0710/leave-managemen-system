import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-utils';
import { sendLeaveNotification } from '@/lib/slack';
import jwt, { JwtPayload } from 'jsonwebtoken';

interface CustomJwtPayload extends JwtPayload {
  id: string;  // Keep as string consistently
  email: string;
  role: string;
}

function extractTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  return authHeader?.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : null;
}

function verifyToken(token: string): CustomJwtPayload | null {
  try {
    return jwt.verify(
      token, 
      process.env.JWT_SECRET || 'default_secret'
    ) as CustomJwtPayload;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const token = extractTokenFromHeader(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      );
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    const userId = parseInt(decoded.id, 10);  // Explicitly use base 10
    const { startDate, endDate, leaveType, reason, halfDay } = data;
    
    if (!startDate || !endDate || !leaveType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Create the leave request with default status as 'pending'
    const isHalfDayValue = halfDay?.isHalfDay || false;
    const periodValue = halfDay?.period || null;

    try {
      const result = await query(
        `INSERT INTO leaves 
         (user_id, start_date, end_date, leave_type, reason, status, is_half_day, half_day_period)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, user_id, start_date, end_date, leave_type, reason, status, is_half_day, half_day_period`,
        [
          userId, 
          startDate, 
          endDate, 
          leaveType, 
          reason || null, 
          'pending', 
          isHalfDayValue, 
          periodValue
        ]
      );

      const leaveRequest = result.rows[0];

      // Optional: Send Slack notification
      try {
        await sendLeaveNotification(leaveRequest);
      } catch (notificationError) {
        console.error('Failed to send Slack notification:', notificationError);
        // Don't block the response if Slack notification fails
      }

      return NextResponse.json(
        { 
          success: true, 
          data: leaveRequest 
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Error creating leave request:', error);
      return NextResponse.json(
        { 
          error: 'Failed to create leave request', 
          details: String(error) 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing leave request:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process leave request', 
        details: String(error) 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      );
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = parseInt(decoded.id, 10);
    const userRole = decoded.role;

    // Determine query based on user role
    let queryText: string;
    let queryParams: string[] | number[];

    if (userRole === 'admin') {
      // Admins can see all leave requests
      queryText = `
        SELECT lr.*, u.name as user_name, u.department 
        FROM leaves lr
        JOIN users u ON lr.user_id = u.id
        ORDER BY lr.start_date DESC
      `;
      queryParams = [];
    } else {
      // Regular users can only see their own leave requests
      queryText = `
        SELECT * 
        FROM leaves 
        WHERE user_id = $1 
        ORDER BY start_date DESC
      `;
      queryParams = [userId.toString()];
    }

    const result = await query(queryText, queryParams);

    return NextResponse.json(
      { 
        success: true, 
        data: result.rows.map(row => ({
          ...row,
          _id: row.id.toString(), // Ensure a string identifier
          user: {
            name: row.user_name,
            department: row.department
          }
        }))
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error retrieving leave requests:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve leave requests', 
        details: String(error) 
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      );
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    const userId = parseInt(decoded.id, 10);  // Explicitly use base 10
    const isAdmin = decoded.role === 'admin';
    
    // Get data from request body
    const data = await request.json();
    const { id, startDate, endDate, leaveType, reason, halfDay } = data;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Leave ID is required' },
        { status: 400 }
      );
    }
    
    if (!startDate || !endDate || !leaveType) {
      return NextResponse.json(
        { error: 'Start date, end date, and leave type are required' },
        { status: 400 }
      );
    }
    
    // Find the leave request first to check ownership
    const leaveResult = await query(
      'SELECT * FROM leaves WHERE id = $1',
      [id]
    );
    
    if (leaveResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }
    
    const leave = leaveResult.rows[0];
    
    // Check if the user owns this leave request or is admin
    if (leave.user_id !== userId && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this leave request' },
        { status: 403 }
      );
    }
    
    // Update the leave request
    const isHalfDayValue = halfDay?.isHalfDay || false;
    const periodValue = halfDay?.period || null;
    
    const updatedLeaveResult = await query(
      `UPDATE leaves 
       SET start_date = $1, end_date = $2, leave_type = $3, reason = $4, is_half_day = $5, half_day_period = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [startDate, endDate, leaveType, reason, isHalfDayValue, periodValue, id]
    );
    
    const updatedLeave = updatedLeaveResult.rows[0];
    
    // Get user details for the updated leave
    const userResult = await query(
      'SELECT id, name, email, department FROM users WHERE id = $1',
      [updatedLeave.user_id]
    );
    
    const user = userResult.rows[0];
    
    // Format response for frontend compatibility
    const formattedLeave = {
      _id: updatedLeave.id.toString(), // Ensure a string identifier
      user: {
        _id: user.id,
        name: user.name,
        email: user.email,
        department: user.department
      },
      startDate: updatedLeave.start_date,
      endDate: updatedLeave.end_date,
      leaveType: updatedLeave.leave_type,
      halfDay: {
        isHalfDay: updatedLeave.is_half_day,
        period: updatedLeave.half_day_period
      },
      reason: updatedLeave.reason,
      status: updatedLeave.status,
      approvedBy: updatedLeave.approved_by_id,
      createdAt: updatedLeave.created_at
    };
    
    return NextResponse.json(formattedLeave, { status: 200 });
  } catch (error: Error | unknown) {
    console.error('Error updating leave request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update leave request' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      );
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    const userId = parseInt(decoded.id, 10);  // Explicitly use base 10
    const isAdmin = decoded.role === 'admin';
    
    // Get the leave ID from the URL
    const { searchParams } = new URL(request.url);
    const leaveId = searchParams.get('id');
    
    if (!leaveId) {
      return NextResponse.json(
        { error: 'Leave ID is required' },
        { status: 400 }
      );
    }
    
    // Find the leave request first to check ownership
    const leaveResult = await query(
      'SELECT * FROM leaves WHERE id = $1',
      [leaveId]
    );
    
    if (leaveResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }
    
    const leave = leaveResult.rows[0];
    
    // Check if the user owns this leave request or is admin
    if (leave.user_id !== userId && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this leave request' },
        { status: 403 }
      );
    }
    
    // Delete the leave request
    await query(
      'DELETE FROM leaves WHERE id = $1',
      [leaveId]
    );
    
    return NextResponse.json(
      { message: 'Leave request deleted successfully' },
      { status: 200 }
    );
  } catch (error: Error | unknown) {
    console.error('Error deleting leave request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete leave request' },
      { status: 500 }
    );
  }
}
