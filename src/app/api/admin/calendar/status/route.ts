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

// Create OAuth2 client
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// GET - Check Google Calendar connection status
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    // Check if we have tokens for this user
    const tokenResult = await query(
      `SELECT * FROM google_oauth_tokens WHERE user_id = $1`,
      [adminCheck.userId]
    );
    
    if (tokenResult.rows.length === 0) {
      return NextResponse.json({ connected: false });
    }
    
    const tokenData = tokenResult.rows[0];
    
    // Verify token is valid by making a simple API call
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: new Date(tokenData.expiry_date).getTime()
    });
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    try {
      // Try to list calendars to verify connection
      await calendar.calendarList.list({ maxResults: 1 });
      return NextResponse.json({ connected: true });
    } catch (apiError) {
      console.error('Error verifying Google Calendar connection:', apiError);
      
      // Token might be expired but can be refreshed
      if (tokenData.refresh_token) {
        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          
          // Update token in database
          await query(
            `UPDATE google_oauth_tokens 
             SET access_token = $1, expiry_date = to_timestamp($2), updated_at = NOW() 
             WHERE user_id = $3`,
            [
              credentials.access_token,
              credentials.expiry_date ? Math.floor((credentials.expiry_date as number) / 1000) : null,
              adminCheck.userId
            ]
          );
          
          return NextResponse.json({ connected: true, refreshed: true });
        } catch (refreshError) {
          console.error('Error refreshing token:', refreshError);
          return NextResponse.json({ connected: false, error: 'Token refresh failed' });
        }
      }
      
      return NextResponse.json({ connected: false, error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Error checking Google Calendar connection status:', error);
    return NextResponse.json(
      { connected: false, error: 'Failed to check connection status' },
      { status: 500 }
    );
  }
}
