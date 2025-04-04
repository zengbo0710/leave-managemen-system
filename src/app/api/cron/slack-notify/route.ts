import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-utils';
import { sendLeavesSummary } from '@/lib/slack';

// This route will be called by a scheduled cron job to send Slack notifications
export async function GET(request: NextRequest) {
  try {
    // Check for a secret token to ensure only authorized calls are processed
    const { searchParams } = new URL(request.url);
    const secretToken = searchParams.get('token');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    // Verify the cron secret token if it's configured
    if (expectedToken && secretToken !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized cron job call' },
        { status: 401 }
      );
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
    
    // Check if scheduled messages are enabled
    if (!config.enabled) {
      return NextResponse.json(
        { message: 'Slack notifications or scheduled summaries are disabled' },
        { status: 200 }
      );
    }
    
    // Default to only sending on workdays
    const scheduleWorkdaysOnly = true;  // In PostgreSQL we simplified this feature
    if (scheduleWorkdaysOnly) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      
      // If it's weekend (0 = Sunday, 6 = Saturday), don't send
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return NextResponse.json(
          { message: 'Skipping notification on weekend' },
          { status: 200 }
        );
      }
    }
    
    // Check if current time matches the scheduled time
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const scheduledTime = config.scheduleTime;
    
    // Compare current time with scheduled time
    // In a production environment, you'd want to use a proper scheduler like node-cron
    // This simple check works for demonstration but isn't precise for production use
    if (currentTime.slice(0, 2) === scheduledTime.slice(0, 2) && 
        Math.abs(parseInt(currentTime.slice(3)) - parseInt(scheduledTime.slice(3))) <= 5) {
      
      // Time matches, send the leaves summary
      const success = await sendLeavesSummary();
      
      if (success) {
        return NextResponse.json(
          { message: 'Leave summary sent successfully' },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          { error: 'Failed to send leave summary' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { message: `Current time ${currentTime} doesn't match scheduled time ${scheduledTime}` },
        { status: 200 }
      );
    }
    
  } catch (error) {
    console.error('Error in scheduled Slack notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
