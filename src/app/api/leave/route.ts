import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Leave from '@/models/Leave';
import User from '@/models/User';
import { sendLeaveNotification } from '@/lib/slack';
import jwt, { JwtPayload } from 'jsonwebtoken';

interface CustomJwtPayload extends JwtPayload {
  id: string;
  email: string;
  role: string;
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
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
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    const userId = decoded.id;
    const { startDate, endDate, leaveType, reason, halfDay } = data;
    
    if (!startDate || !endDate || !leaveType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Create the leave request with default status as 'approved'
    const leaveRequest = await Leave.create({
      user: userId,
      startDate,
      endDate,
      leaveType,
      reason,
      status: 'approved', // Set default status to approved
      halfDay: halfDay || { isHalfDay: false, period: null }
    });
    
    // Get user details for Slack notification
    const user = await User.findById(userId);
    
    if (user) {
      // Send Slack notification
      await sendLeaveNotification({
        userName: user.name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        leaveType,
        reason,
        isHalfDay: halfDay?.isHalfDay || false,
        halfDayPeriod: halfDay?.period || undefined
      });
      
      // Update leave request to mark that notification was sent
      await Leave.findByIdAndUpdate(leaveRequest._id, {
        slackNotificationSent: true
      });
    }
    
    return NextResponse.json(
      { success: true, data: leaveRequest },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating leave request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create leave request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
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
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    const userId = decoded.id;
    const { searchParams } = new URL(request.url);
    const isAdmin = decoded.role === 'admin';
    
    // If admin, allow fetching all leave requests or filtered by user ID
    // If employee, only allow fetching their own leave requests
    const queryUserId = searchParams.get('userId');
    let query = {};
    
    if (isAdmin && queryUserId) {
      query = { user: queryUserId };
    } else if (isAdmin) {
      // Admin can see all leave requests
      query = {};
    } else {
      // Regular employees can only see their own leave requests
      query = { user: userId };
    }
    
    // Make sure to fully populate user details
    const leaveRequests = await Leave.find(query)
      .populate({
        path: 'user',
        select: '_id name email department'
      })
      .sort({ createdAt: -1 });
    
    return NextResponse.json(
      leaveRequests,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching leave requests:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leave requests' },
      { status: 500 }
    );
  }
}
