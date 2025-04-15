import { query } from '@/lib/db-utils';
import { google } from 'googleapis';
import { getGoogleCredentials } from '../services/googleCredentialService';

// Create OAuth2 client
const getOAuth2Client = async (userId: number) => {
  // Try to get credentials from database first
  const authConfig = await getGoogleCredentials();
  
  // Set clientId, clientSecret and redirectUri from database or environment
  let clientId, clientSecret, redirectUri;
  
  if (authConfig) {
    // Use credentials from database
    clientId = authConfig.clientId;
    clientSecret = authConfig.clientSecret;
    redirectUri = authConfig.redirectUri;
  } else {
    // Fallback to environment variables
    clientId = process.env.GOOGLE_CLIENT_ID;
    clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground';
  }
  
  // Validate that we have credentials from somewhere
  if (!clientId || !clientSecret) {
    console.error('Missing required Google OAuth credentials in both database and environment');
    return null;
  }

  // Create the OAuth client with proper credentials
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
  
  // Get tokens for this user
  const tokenResult = await query(
    `SELECT * FROM google_oauth_tokens WHERE user_id = $1`,
    [userId]
  );
  
  if (tokenResult.rows.length === 0) {
    // Return null instead of throwing an error
    return null;
  }
  
  const tokenData = tokenResult.rows[0];
  
  // Validate tokens before setting credentials
  if (!tokenData.access_token) {
    console.error('No access token found for user');
    return null;
  }
  
  // Set auth credentials with all required fields
  const authTokens: any = {
    access_token: tokenData.access_token
  };
  
  // Add refresh token if available
  if (tokenData.refresh_token) {
    authTokens.refresh_token = tokenData.refresh_token;
  }
  
  // Add expiry date if available
  if (tokenData.expiry_date) {
    authTokens.expiry_date = new Date(tokenData.expiry_date).getTime();
  }
  
  oauth2Client.setCredentials(authTokens);
  
  return oauth2Client;
};

// Get calendar configurations for a specific leave type or "All"
const getCalendarConfigs = async (leaveType: string) => {
  const configs = await query(
    `SELECT * FROM google_calendar_configs 
     WHERE (leave_type = $1 OR leave_type = 'All') AND is_active = true`,
    [leaveType]
  );
  
  return configs.rows;
};

// Sync leave request to Google Calendar
export const syncLeaveToCalendar = async (leaveId: number, adminUserId: number) => {
  // Check for credentials in database first, then environment variables
  const credentials = await getGoogleCredentials();
  if (!credentials) {
    console.log('Missing required Google OAuth credentials in both database and environment variables');
    return {
      success: false,
      error: 'Missing Google OAuth credentials',
      message: 'Please configure Google OAuth credentials in Admin > Calendar Settings'
    };
  }
  
  try {
    // Check if the required tables exist to avoid errors
    try {
      // Quick check if tables exist by getting the first row
      await query('SELECT * FROM google_oauth_tokens LIMIT 1', []);
    } catch (tableError) {
      console.log('Google Calendar tables not set up yet, skipping sync');
      return {
        success: false,
        error: 'Database not configured',
        message: 'Google Calendar tables not set up yet'
      };
    }

    // Get leave details
    const leaveResult = await query(
      `SELECT l.*, u.name as user_name, u.email as user_email, u.department as user_department
       FROM leaves l
       JOIN users u ON l.user_id = u.id
       WHERE l.id = $1`,
      [leaveId]
    );
    
    if (leaveResult.rows.length === 0) {
      console.error(`Leave request with ID ${leaveId} not found`);
      return;
    }
    
    const leave = leaveResult.rows[0];
    
    // Get calendar configurations for this leave type
    const configs = await getCalendarConfigs(leave.leave_type);
    
    if (configs.length === 0) {
      console.log(`No calendar configurations found for leave type: ${leave.leave_type}`);
      return;
    }
    
    const oauth2Client = await getOAuth2Client(adminUserId);
    
    // If no OAuth client (no tokens found), skip sync
    if (!oauth2Client) {
      console.log(`No Google OAuth tokens found for user ${adminUserId}, skipping sync`);
      return;
    }
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Process each calendar configuration
    for (const config of configs) {
      // Check if event already exists for this leave and calendar
      const existingEventResult = await query(
        `SELECT * FROM google_calendar_events 
         WHERE leave_id = $1 AND calendar_id = $2`,
        [leaveId, config.calendar_id]
      );
      
      const existingEvent = existingEventResult.rows[0];
      
      // Format event details
      const eventStartTime = new Date(leave.start_date);
      const eventEndTime = new Date(leave.end_date);
      
      // If it's a half-day leave, adjust the time accordingly
      if (leave.is_half_day) {
        if (leave.period === 'morning') {
          eventStartTime.setHours(9, 0, 0);
          eventEndTime.setHours(13, 0, 0);
        } else {
          eventStartTime.setHours(13, 0, 0);
          eventEndTime.setHours(18, 0, 0);
        }
      } else {
        // All day events in Google Calendar require the end date to be the day AFTER
        // the actual end date (exclusive end date)
        eventEndTime.setDate(eventEndTime.getDate() + 1);
      }
      
      // Following strict Google Calendar API format requirements
      let eventDetails: any = {
        summary: `${leave.user_name}: ${leave.leave_type} Leave`,
        description: `${leave.reason || 'No reason provided'}\n\nStatus: ${leave.status}\nDepartment: ${leave.user_department}`,
        colorId: leave.status === 'approved' ? '10' : (leave.status === 'rejected' ? '4' : '5')
      };
      
      if (leave.is_half_day) {
        // Half-day leaves (time-specific)
        eventDetails.start = {
          dateTime: eventStartTime.toISOString(),
          timeZone: 'Asia/Shanghai'
        };
        eventDetails.end = {
          dateTime: eventEndTime.toISOString(),
          timeZone: 'Asia/Shanghai'
        };
        
        // Add half-day info to description
        eventDetails.description += `\nHalf-day: ${leave.period === 'morning' ? 'Morning' : 'Afternoon'}`;
      } else {
        // Full-day leaves (all-day events)
        // Note: For all-day events, end date should be the next day after the actual end
        eventDetails.start = {
          date: eventStartTime.toISOString().split('T')[0]
        };
        eventDetails.end = {
          date: eventEndTime.toISOString().split('T')[0]
        };
      }
      
      if (existingEvent) {
        // Update existing event
        try {
          const response = await calendar.events.update({
            calendarId: config.calendar_id,
            eventId: existingEvent.event_id,
            requestBody: eventDetails,
          });
          
          // Update last_synced timestamp
          await query(
            `UPDATE google_calendar_events 
             SET last_synced = NOW(), updated_at = NOW() 
             WHERE id = $1`,
            [existingEvent.id]
          );
          
          console.log(`Updated calendar event ${response.data.id} for leave ${leaveId}`);
        } catch (error) {
          console.error(`Error updating calendar event for leave ${leaveId}:`, error);
        }
      } else {
        // Create new event
        try {
          // Debug log to see what's being sent
          console.log('Calendar ID:', config.calendar_id);
          console.log('Event Details:', JSON.stringify(eventDetails, null, 2));
          console.log('OAuth Client Info:', {
            clientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set',
            redirectUri: process.env.GOOGLE_REDIRECT_URI || 'Using default',
            hasAccessToken: !!oauth2Client.credentials.access_token,
            hasRefreshToken: !!oauth2Client.credentials.refresh_token,
            hasExpiryDate: !!oauth2Client.credentials.expiry_date
          });
          
          // Make sure calendar ID is properly formatted (no leading/trailing spaces)
          const calendarId = config.calendar_id.trim();
          
          const response = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: eventDetails,
          });
          
          // Save event mapping
          await query(
            `INSERT INTO google_calendar_events 
             (leave_id, event_id, calendar_id) 
             VALUES ($1, $2, $3)`,
            [leaveId, response.data.id, config.calendar_id]
          );
          
          console.log(`Created calendar event ${response.data.id} for leave ${leaveId}`);
        } catch (error: any) {
          console.error(`Error creating calendar event for leave ${leaveId}:`, error);
          
          // More detailed error logging
          if (error.response) {
            console.error('Error details:', JSON.stringify(error.response.data, null, 2));
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error syncing leave ${leaveId} to Google Calendar:`, error);
  }
};

// Delete event from Google Calendar when leave is deleted
export const deleteLeaveFromCalendar = async (leaveId: number, adminUserId: number) => {
  try {
    // First check if the required tables exist to avoid errors
    try {
      // Quick check if tables exist
      await query('SELECT * FROM google_calendar_events LIMIT 1', []);
    } catch (tableError) {
      console.log('Google Calendar tables not set up yet, skipping delete');
      return;
    }

    // Get event mappings for this leave
    const eventMappings = await query(
      `SELECT * FROM google_calendar_events WHERE leave_id = $1`,
      [leaveId]
    );
    
    if (eventMappings.rows.length === 0) {
      console.log(`No calendar events found for leave ${leaveId}`);
      return;
    }
    
    const oauth2Client = await getOAuth2Client(adminUserId);
    
    // If no OAuth client (no tokens found), skip delete
    if (!oauth2Client) {
      console.log(`No Google OAuth tokens found for user ${adminUserId}, skipping delete`);
      return;
    }
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Delete each event
    for (const mapping of eventMappings.rows) {
      try {
        await calendar.events.delete({
          calendarId: mapping.calendar_id,
          eventId: mapping.event_id,
        });
        
        console.log(`Deleted calendar event ${mapping.event_id} for leave ${leaveId}`);
      } catch (error) {
        console.error(`Error deleting calendar event ${mapping.event_id}:`, error);
      }
    }
    
    // Delete all mappings for this leave
    await query(
      `DELETE FROM google_calendar_events WHERE leave_id = $1`,
      [leaveId]
    );
  } catch (error) {
    console.error(`Error deleting calendar events for leave ${leaveId}:`, error);
  }
};
