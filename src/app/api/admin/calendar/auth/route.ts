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

// GET - Get Google Auth URL
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    const oauth2Client = getOAuth2Client();
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force to get refresh token
      state: adminCheck.userId?.toString() // Pass userId as state
    });
    
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
}

// DELETE - Revoke Google Calendar access
export async function DELETE(request: NextRequest) {
  try {
    const adminCheck = await verifyAdminRole(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    // Get tokens from database
    const tokenResult = await query(
      `SELECT * FROM google_oauth_tokens WHERE user_id = $1`,
      [adminCheck.userId]
    );
    
    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        { message: 'No Google connection found to disconnect' },
        { status: 200 }
      );
    }
    
    const tokenData = tokenResult.rows[0];
    
    // Revoke token if exists
    if (tokenData.access_token) {
      const oauth2Client = getOAuth2Client();
      try {
        await oauth2Client.revokeToken(tokenData.access_token);
      } catch (revokeError) {
        console.error('Error revoking token (continuing):', revokeError);
        // Continue with deletion even if revoke fails
      }
    }
    
    // Delete from database
    await query(
      `DELETE FROM google_oauth_tokens WHERE user_id = $1`,
      [adminCheck.userId]
    );
    
    return NextResponse.json(
      { message: 'Google Calendar disconnected successfully' }
    );
  } catch (error) {
    console.error('Error disconnecting from Google Calendar:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect from Google Calendar' },
      { status: 500 }
    );
  }
}
