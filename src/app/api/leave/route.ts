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
    
    // All users can see all leave requests, but filtered view is supported
    const queryUserId = searchParams.get('userId');
    let query = {};
    
    if (queryUserId) {
      // If a specific user ID is requested, filter by that
      query = { user: queryUserId };
    } else {
      // Otherwise, show all leave requests for everyone
      query = {};
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

export async function PATCH(request: NextRequest) {
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
    const leave = await Leave.findById(id);
    
    if (!leave) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }
    
    // Check if the user owns this leave request or is admin
    if (leave.user.toString() !== userId && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this leave request' },
        { status: 403 }
      );
    }
    
    // Update the leave request
    const updatedLeave = await Leave.findByIdAndUpdate(
      id,
      {
        startDate,
        endDate,
        leaveType,
        reason,
        halfDay,
      },
      { new: true }
    ).populate({
      path: 'user',
      select: '_id name email department'
    });
    
    return NextResponse.json(updatedLeave, { status: 200 });
  } catch (error: any) {
    console.error('Error updating leave request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update leave request' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const leave = await Leave.findById(leaveId);
    
    if (!leave) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }
    
    // Check if the user owns this leave request or is admin
    if (leave.user.toString() !== userId && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this leave request' },
        { status: 403 }
      );
    }
    
    // Delete the leave request
    await Leave.findByIdAndDelete(leaveId);
    
    return NextResponse.json(
      { message: 'Leave request deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting leave request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete leave request' },
      { status: 500 }
    );
  }
}
