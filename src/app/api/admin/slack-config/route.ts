import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import SlackConfig from '@/models/SlackConfig';
import jwt from 'jsonwebtoken';

// Custom JWT Payload interface
interface CustomJwtPayload {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Admin authorization middleware
async function authorizeAdmin(request: NextRequest) {
  // Extract the token from the Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      )
    };
  }
  
  const token = authHeader.split(' ')[1];
  
  // Verify the token and extract user info
  let decoded: CustomJwtPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as CustomJwtPayload;
  } catch (error) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    };
  }
  
  // Check if user is admin
  if (decoded.role !== 'admin') {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    };
  }
  
  return { authorized: true, userId: decoded.id };
}

// GET - Retrieve Slack configuration
export async function GET(request: NextRequest) {
  try {
    // Check admin authorization
    const auth = await authorizeAdmin(request);
    if (!auth.authorized) {
      return auth.response;
    }
    
    await connectToDatabase();
    
    // Get the Slack configuration
    const config = await SlackConfig.getSingletonConfig();
    
    if (!config) {
      return NextResponse.json(
        { message: 'No Slack configuration found' },
        { status: 404 }
      );
    }
    
    // Return the config without the token for security
    return NextResponse.json({
      ...config.toObject(),
      token: config.token ? '•••••••••••••••••••••••••••' : '',  // Mask the token
    }, { status: 200 });
    
  } catch (error: any) {
    console.error('Error retrieving Slack configuration:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// POST - Create or update Slack configuration
export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    const auth = await authorizeAdmin(request);
    if (!auth.authorized) {
      return auth.response;
    }
    
    await connectToDatabase();
    
    // Get data from request body
    const data = await request.json();
    const { 
      token, 
      channelId, 
      enabled, 
      dayRange,
      scheduleEnabled,
      scheduleTime,
      scheduleWorkdaysOnly 
    } = data;
    
    // Validate required fields
    if (!token || !channelId) {
      return NextResponse.json(
        { error: 'Slack token and channel ID are required' },
        { status: 400 }
      );
    }
    
    // Validate dayRange
    if (dayRange && (dayRange < 1 || dayRange > 30)) {
      return NextResponse.json(
        { error: 'Day range must be between 1 and 30' },
        { status: 400 }
      );
    }
    
    // Validate scheduleTime format if provided
    if (scheduleTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(scheduleTime)) {
      return NextResponse.json(
        { error: 'Schedule time must be in the format HH:MM' },
        { status: 400 }
      );
    }
    
    // Create or update config
    const updatedConfig = await SlackConfig.updateConfig({
      token,
      channelId,
      enabled: enabled !== undefined ? enabled : true,
      dayRange: dayRange || 3,
      scheduleEnabled: scheduleEnabled !== undefined ? scheduleEnabled : true,
      scheduleTime: scheduleTime || '08:30',
      scheduleWorkdaysOnly: scheduleWorkdaysOnly !== undefined ? scheduleWorkdaysOnly : true,
    });
    
    // Return the updated config without the token for security
    return NextResponse.json({
      ...updatedConfig.toObject(),
      token: '•••••••••••••••••••••••••••',  // Mask the token
    }, { status: 200 });
    
  } catch (error: any) {
    console.error('Error updating Slack configuration:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// DELETE - Delete Slack configuration
export async function DELETE(request: NextRequest) {
  try {
    // Check admin authorization
    const auth = await authorizeAdmin(request);
    if (!auth.authorized) {
      return auth.response;
    }
    
    await connectToDatabase();
    
    // Find the config
    const config = await SlackConfig.getSingletonConfig();
    
    if (!config) {
      return NextResponse.json(
        { message: 'No Slack configuration found' },
        { status: 404 }
      );
    }
    
    // Delete the config
    await SlackConfig.findByIdAndDelete(config._id);
    
    return NextResponse.json(
      { message: 'Slack configuration deleted successfully' },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error('Error deleting Slack configuration:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// PATCH - Test Slack configuration by sending a test message
export async function PATCH(request: NextRequest) {
  try {
    // Check admin authorization
    const auth = await authorizeAdmin(request);
    if (!auth.authorized) {
      return auth.response;
    }
    
    await connectToDatabase();
    
    // Check if we're sending a test message or summary
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    // Import slack lib
    const { sendLeavesSummary, getSlackClient } = require('@/lib/slack');
    
    if (action === 'test') {
      // Send a test message
      const { client, config } = await getSlackClient();
      
      if (!client || !config) {
        return NextResponse.json(
          { error: 'Slack configuration is missing or invalid' },
          { status: 400 }
        );
      }
      
      await client.chat.postMessage({
        channel: config.channelId,
        text: 'Test message from Leave Management System',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🧪 Test Message',
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'This is a test message from your Leave Management System. If you can see this, your Slack integration is working correctly!'
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Sent at ${new Date().toLocaleString()}`
              }
            ]
          }
        ]
      });
      
      return NextResponse.json(
        { message: 'Test message sent successfully' },
        { status: 200 }
      );
    } else if (action === 'summary') {
      // Send a leave summary
      const success = await sendLeavesSummary();
      
      if (!success) {
        return NextResponse.json(
          { error: 'Failed to send leave summary' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { message: 'Leave summary sent successfully' },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { error: 'Invalid action specified' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error testing Slack configuration:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
