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

// GET - Test Google Calendar API directly
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    const userId = adminCheck.userId;
    
    // Check environment variables
    const envCheck = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set',
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'Not set'
    };
    
    // Check if OAuth tokens exist
    const tokenResult = await query(
      `SELECT * FROM google_oauth_tokens WHERE user_id = $1`,
      [userId]
    );
    
    if (tokenResult.rows.length === 0) {
      return NextResponse.json({ 
        error: 'No OAuth tokens found',
        envCheck
      }, { status: 404 });
    }
    
    const tokenData = tokenResult.rows[0];
    
    // Get the calendar configs
    const calendarConfigs = await query(
      `SELECT * FROM google_calendar_configs WHERE is_active = true LIMIT 1`,
      []
    );
    
    if (calendarConfigs.rows.length === 0) {
      return NextResponse.json({ 
        error: 'No calendar configurations found',
        envCheck,
        tokenStatus: {
          hasAccessToken: !!tokenData.access_token,
          hasRefreshToken: !!tokenData.refresh_token,
          expiryDate: tokenData.expiry_date ? new Date(tokenData.expiry_date).toISOString() : 'Not set'
        }
      }, { status: 404 });
    }
    
    const calendarConfig = calendarConfigs.rows[0];
    
    // Create OAuth client with detailed error handling
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json({ 
        error: 'Missing required Google OAuth credentials in environment variables',
        envCheck
      }, { status: 500 });
    }
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
    );
    
    // Validate tokens
    if (!tokenData.access_token) {
      return NextResponse.json({ 
        error: 'Access token is missing or invalid',
        tokenDetails: {
          accessTokenLength: tokenData.access_token ? tokenData.access_token.length : 0,
          refreshTokenExists: !!tokenData.refresh_token,
          expiryDate: tokenData.expiry_date ? new Date(tokenData.expiry_date).toISOString() : 'Not set'
        },
        envCheck
      }, { status: 400 });
    }
    
    // Set credentials with proper structure
    const credentials: any = {
      access_token: tokenData.access_token
    };
    
    if (tokenData.refresh_token) {
      credentials.refresh_token = tokenData.refresh_token;
    }
    
    if (tokenData.expiry_date) {
      credentials.expiry_date = new Date(tokenData.expiry_date).getTime();
    }
    
    oauth2Client.setCredentials(credentials);
    
    // Test calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    try {
      // Step 1: First try to list calendars as a connectivity test
      try {
        await calendar.calendarList.list({ maxResults: 1 });
      } catch (listError: any) {
        return NextResponse.json({
          error: 'Failed to list calendars',
          details: listError.message,
          response: listError.response?.data,
          credentials: {
            hasAccessToken: !!credentials.access_token,
            accessTokenPrefix: credentials.access_token ? `${credentials.access_token.substring(0, 5)}...` : null,
            hasRefreshToken: !!credentials.refresh_token,
            hasExpiryDate: !!credentials.expiry_date
          },
          oauthClient: {
            redirectUri: oauth2Client.redirectUri,
            clientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 5) + '...'
          },
          envCheck
        }, { status: 500 });
      }
      
      // Step 2: Try creating a simple event with minimal fields
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const simpleEvent = {
        summary: 'Direct Test Event',
        start: {
          date: today.toISOString().split('T')[0]
        },
        end: {
          date: tomorrow.toISOString().split('T')[0]
        }
      };
      
      try {
        const response = await calendar.events.insert({
          calendarId: calendarConfig.calendar_id.trim(),
          requestBody: simpleEvent
        });
        
        return NextResponse.json({
          success: true,
          message: 'API test successful - event created',
          event: {
            id: response.data.id,
            htmlLink: response.data.htmlLink,
            summary: response.data.summary
          },
          calendarConfig: {
            id: calendarConfig.calendar_id,
            name: calendarConfig.calendar_name
          },
          oauthStatus: {
            hasAccessToken: !!credentials.access_token,
            hasRefreshToken: !!credentials.refresh_token,
            hasExpiryDate: !!credentials.expiry_date
          },
          envCheck
        });
      } catch (createError: any) {
        return NextResponse.json({
          error: 'Failed to create calendar event',
          calendarId: calendarConfig.calendar_id,
          eventDetails: simpleEvent,
          errorDetails: createError.message,
          response: createError.response?.data,
          credentials: {
            hasAccessToken: !!credentials.access_token,
            accessTokenPrefix: credentials.access_token ? `${credentials.access_token.substring(0, 5)}...` : null,
            hasRefreshToken: !!credentials.refresh_token,
            hasExpiryDate: !!credentials.expiry_date
          },
          oauthClient: {
            redirectUri: oauth2Client.redirectUri,
            clientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 5) + '...'
          },
          envCheck
        }, { status: 500 });
      }
    } catch (apiError: any) {
      return NextResponse.json({
        success: false,
        error: apiError.message,
        details: apiError.response?.data || {},
        calendarId: calendarConfig.calendar_id,
        tokenStatus: {
          hasAccessToken: !!tokenData.access_token,
          hasRefreshToken: !!tokenData.refresh_token,
          expiryDate: tokenData.expiry_date ? new Date(tokenData.expiry_date).toISOString() : 'Not set'
        },
        envCheck
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