import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Leave from '@/models/Leave';
import User from '@/models/User';
import { sendLeaveNotification } from '@/lib/slack';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const data = await request.json();
    
    const { userId, startDate, endDate, leaveType, reason, halfDay } = data;
    
    if (!userId || !startDate || !endDate || !leaveType || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Create the leave request
    const leaveRequest = await Leave.create({
      user: userId,
      startDate,
      endDate,
      leaveType,
      reason,
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    const query = userId ? { user: userId } : {};
    const leaveRequests = await Leave.find(query)
      .populate('user', 'name email department')
      .sort({ createdAt: -1 });
    
    return NextResponse.json(
      { success: true, data: leaveRequests },
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
