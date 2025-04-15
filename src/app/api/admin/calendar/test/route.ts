import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-utils';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

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

// GET - Test Google Calendar API
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    const userId = adminCheck.userId;
    
    // Check if OAuth tokens exist
    const tokenResult = await query(
      `SELECT * FROM google_oauth_tokens WHERE user_id = $1`,
      [userId]
    );
    
    if (tokenResult.rows.length === 0) {
      return NextResponse.json({ error: 'No OAuth tokens found' }, { status: 404 });
    }
    
    const tokenData = tokenResult.rows[0];
    
    // Get the calendar configs
    const calendarConfigs = await query(
      `SELECT * FROM google_calendar_configs WHERE is_active = true LIMIT 1`,
      []
    );
    
    if (calendarConfigs.rows.length === 0) {
      return NextResponse.json({ error: 'No calendar configurations found' }, { status: 404 });
    }
    
    const calendarConfig = calendarConfigs.rows[0];
    
    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: new Date(tokenData.expiry_date).getTime()
    });
    
    // Test calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // 1. Test listing calendars (check if we can connect at all)
    try {
      const calendarList = await calendar.calendarList.list({
        maxResults: 10
      });
      
      // 2. Test events for both formats
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Test a simple all-day event (date only)
      const allDayEvent = {
        summary: 'Test All-Day Event',
        description: 'This is a test all-day event',
        start: {
          date: today.toISOString().split('T')[0]
        },
        end: {
          date: tomorrow.toISOString().split('T')[0]
        }
      };
      
      // Test a time-specific event (dateTime with timeZone)
      const timeSpecificEvent = {
        summary: 'Test Time-Specific Event',
        description: 'This is a test time-specific event',
        start: {
          dateTime: today.toISOString(),
          timeZone: 'Asia/Shanghai'
        },
        end: {
          dateTime: new Date(today.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours later
          timeZone: 'Asia/Shanghai'
        }
      };
      
      const allDayResponse = await calendar.events.insert({
        calendarId: calendarConfig.calendar_id,
        requestBody: allDayEvent
      });
      
      const timeSpecificResponse = await calendar.events.insert({
        calendarId: calendarConfig.calendar_id,
        requestBody: timeSpecificEvent
      });
      
      return NextResponse.json({
        success: true,
        message: 'Tests successful',
        calendarList: calendarList.data.items?.map(cal => ({
          id: cal.id,
          summary: cal.summary
        })),
        allDayEvent: {
          created: true,
          id: allDayResponse.data.id,
          link: allDayResponse.data.htmlLink
        },
        timeSpecificEvent: {
          created: true,
          id: timeSpecificResponse.data.id,
          link: timeSpecificResponse.data.htmlLink
        }
      });
    } catch (apiError: any) {
      return NextResponse.json({
        success: false,
        error: apiError.message,
        details: apiError.response?.data || {},
        calendarId: calendarConfig.calendar_id,
        tokenStatus: {
          hasAccessToken: !!tokenData.access_token,
          hasRefreshToken: !!tokenData.refresh_token,
          expiryDate: new Date(tokenData.expiry_date).toISOString()
        }
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error testing Google Calendar API:', error);
    return NextResponse.json({
      error: 'Failed to test Google Calendar API',
      details: error.message
    }, { status: 500 });
  }
}