import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-utils';
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
    
    // Get the Slack configuration
    const result = await query(
      'SELECT * FROM slack_configs LIMIT 1',
      []
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { message: 'No Slack configuration found' },
        { status: 404 }
      );
    }
    
    const config = result.rows[0];
    
    // Return the config without the token for security
    return NextResponse.json({
      id: config.id,
      webhook_url: config.webhook_url,
      channel_id: config.channel_id,
      enabled: config.enabled,
      bot_token: config.bot_token ? '•••••••••••••••••••••••••••' : '',  // Mask the token
      created_at: config.created_at,
      updated_at: config.updated_at
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
    
    // Get data from request body
    const data = await request.json();
    const { 
      token, 
      channelId, 
      enabled 
    } = data;
    
    // Validate required fields
    if (!token || !channelId) {
      return NextResponse.json(
        { error: 'Slack token and channel ID are required' },
        { status: 400 }
      );
    }
    
    // Check if a configuration already exists
    const existingConfig = await query(
      'SELECT * FROM slack_configs LIMIT 1',
      []
    );
    
    let result;
    
    if (existingConfig.rows.length > 0) {
      // Update existing configuration
      result = await query(
        `UPDATE slack_configs 
         SET webhook_url = $1, channel_id = $2, bot_token = $3, enabled = $4, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $5 
         RETURNING *`,
        [data.webhookUrl || null, channelId, token, enabled !== undefined ? enabled : true, existingConfig.rows[0].id]
      );
    } else {
      // Create new configuration
      result = await query(
        `INSERT INTO slack_configs (webhook_url, channel_id, bot_token, enabled) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [data.webhookUrl || null, channelId, token, enabled !== undefined ? enabled : true]
      );
    }
    
    const updatedConfig = result.rows[0];
    
    // Return the updated config without the token for security
    return NextResponse.json({
      id: updatedConfig.id,
      webhook_url: updatedConfig.webhook_url,
      channel_id: updatedConfig.channel_id,
      enabled: updatedConfig.enabled,
      bot_token: '•••••••••••••••••••••••••••',  // Mask the token
      created_at: updatedConfig.created_at,
      updated_at: updatedConfig.updated_at
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
    
    // Check if configuration exists
    const existingConfig = await query(
      'SELECT * FROM slack_configs LIMIT 1',
      []
    );
    
    if (existingConfig.rows.length === 0) {
      return NextResponse.json(
        { message: 'No Slack configuration found' },
        { status: 404 }
      );
    }
    
    // Delete the config
    await query(
      'DELETE FROM slack_configs WHERE id = $1',
      [existingConfig.rows[0].id]
    );
    
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
