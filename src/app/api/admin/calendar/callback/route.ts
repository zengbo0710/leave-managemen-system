import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-utils';
import { google } from 'googleapis';

// Create OAuth2 client
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// GET - Handle OAuth callback
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // This contains the user ID
    const error = url.searchParams.get('error');
    
    if (error) {
      console.error('Google OAuth error:', error);
      // Redirect to calendar page with error parameter
      return NextResponse.redirect(`${process.env.APP_URL}/admin/calendar?error=${encodeURIComponent('Google authentication failed')}`);
    }
    
    if (!code || !state) {
      console.error('Missing code or state in callback');
      return NextResponse.redirect(`${process.env.APP_URL}/admin/calendar?error=${encodeURIComponent('Invalid callback parameters')}`);
    }
    
    const userId = parseInt(state, 10);
    if (isNaN(userId)) {
      console.error('Invalid user ID in state parameter');
      return NextResponse.redirect(`${process.env.APP_URL}/admin/calendar?error=${encodeURIComponent('Invalid user identification')}`);
    }
    
    // Exchange code for tokens
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in database
    // First check if entry exists
    const existingToken = await query(
      `SELECT * FROM google_oauth_tokens WHERE user_id = $1`,
      [userId]
    );
    
    if (existingToken.rows.length > 0) {
      // Update existing token
      await query(
        `UPDATE google_oauth_tokens 
         SET access_token = $1, refresh_token = $2, expiry_date = to_timestamp($3), updated_at = NOW() 
         WHERE user_id = $4`,
        [
          tokens.access_token,
          tokens.refresh_token || existingToken.rows[0].refresh_token, // Keep old refresh token if new one not provided
          tokens.expiry_date ? Math.floor((tokens.expiry_date as number) / 1000) : null,
          userId
        ]
      );
    } else {
      // Create new token entry
      await query(
        `INSERT INTO google_oauth_tokens 
         (user_id, access_token, refresh_token, expiry_date) 
         VALUES ($1, $2, $3, to_timestamp($4))`,
        [
          userId,
          tokens.access_token,
          tokens.refresh_token,
          tokens.expiry_date ? Math.floor((tokens.expiry_date as number) / 1000) : null
        ]
      );
    }
    
    // Redirect back to calendar page with success message
    return NextResponse.redirect(`${process.env.APP_URL}/admin/calendar?success=Connected to Google Calendar successfully`);
  } catch (error) {
    console.error('Error handling Google OAuth callback:', error);
    return NextResponse.redirect(`${process.env.APP_URL}/admin/calendar?error=${encodeURIComponent('Failed to complete Google authentication')}`);
  }
}
