import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-utils';
import { sendLeaveNotification } from '@/lib/slack';
import jwt, { JwtPayload } from 'jsonwebtoken';

interface CustomJwtPayload extends JwtPayload {
  id: string;  // Keep as string consistently
  email: string;
  role: string;
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Extract the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token and extract user ID
    let decoded: CustomJwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as CustomJwtPayload;
    } catch {
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
    
    // Create the leave request with default status as 'approved'
    const isHalfDayValue = halfDay?.isHalfDay || false;
    const periodValue = halfDay?.period || null;
    
    const leaveResult = await query(
      `INSERT INTO leaves 
       (user_id, start_date, end_date, leave_type, reason, status, is_half_day, period) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [userId, startDate, endDate, leaveType, reason, 'approved', isHalfDayValue, periodValue]
    );
    
    const leaveRequest = leaveResult.rows[0];
    
    // Get user details for Slack notification
    const userResult = await query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    const user = userResult.rows[0];
    
    if (user) {
      // Send Slack notification
      await sendLeaveNotification({
        userName: user.name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        leaveType,
        reason,
        isHalfDay: isHalfDayValue,
        halfDayPeriod: periodValue
      });
      
      // Update leave request to mark that notification was sent
      await query(
        'UPDATE leaves SET slack_notification_sent = $1 WHERE id = $2',
        [true, leaveRequest.id]
      );
    }
    
    return NextResponse.json(
      { success: true, data: leaveRequest },
      { status: 201 }
    );
  } catch (error: Error | unknown) {
    console.error('Error creating leave request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create leave request';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Extract the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token and extract user ID
    let decoded: CustomJwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as CustomJwtPayload;
    } catch {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    // Remove unused variables
    // We'll keep the queryUserId which is used
    const queryUserId = searchParams.get('userId');
    
    let leaveRequests;
    if (queryUserId) {
      // If a specific user ID is requested, filter by that
      const result = await query(
        `SELECT l.*, 
                u.id as user_id, u.name as user_name, u.email as user_email, u.department as user_department
         FROM leaves l
         JOIN users u ON l.user_id = u.id
         WHERE l.user_id = $1
         ORDER BY l.created_at DESC`,
        [parseInt(queryUserId)]
      );
      leaveRequests = result.rows;
    } else {
      // Otherwise, show all leave requests for everyone
      const result = await query(
        `SELECT l.*, 
                u.id as user_id, u.name as user_name, u.email as user_email, u.department as user_department
         FROM leaves l
         JOIN users u ON l.user_id = u.id
         ORDER BY l.created_at DESC`,
        []
      );
      leaveRequests = result.rows;
    }
    
    // Format the response to match the expected structure in the frontend
    const formattedLeaveRequests = leaveRequests.map(leave => ({
      _id: leave.id,
      user: {
        _id: leave.user_id,
        name: leave.user_name,
        email: leave.user_email,
        department: leave.user_department
      },
      startDate: leave.start_date,
      endDate: leave.end_date,
      leaveType: leave.leave_type,
      halfDay: {
        isHalfDay: leave.is_half_day,
        period: leave.period
      },
      reason: leave.reason,
      status: leave.status,
      approvedBy: leave.approved_by_id,
      createdAt: leave.created_at
    }));
    
    return NextResponse.json(
      formattedLeaveRequests,
      { status: 200 }
    );
  } catch (error: Error | unknown) {
    console.error('Error fetching leave requests:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch leave requests' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Extract the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token and extract user ID
    let decoded: CustomJwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as CustomJwtPayload;
    } catch {
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
       SET start_date = $1, end_date = $2, leave_type = $3, reason = $4, is_half_day = $5, period = $6, updated_at = NOW()
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
      _id: updatedLeave.id,
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
        period: updatedLeave.period
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
    // Extract the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token and extract user ID
    let decoded: CustomJwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as CustomJwtPayload;
    } catch {
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
