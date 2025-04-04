import { WebClient } from '@slack/web-api';
import { query } from './db-utils';

// This function loads the Slack config from database and creates a client
export async function getSlackClient(): Promise<{ client: WebClient | null, config: any | null }> {
  try {
    // Get the latest config from the database
    const result = await query(
      'SELECT * FROM slack_configs LIMIT 1',
      []
    );
    
    if (result.rows.length === 0) {
      return { client: null, config: null };
    }
    
    const config = result.rows[0];
    
    if (!config || !config.bot_token || !config.enabled) {
      return { client: null, config: null };
    }
    
    const client = new WebClient(config.bot_token);
    return { client, config };
  } catch (error) {
    console.error('Error getting Slack client:', error);
    return { client: null, config: null };
  }
}

// Send a notification for a single leave request
export async function sendLeaveNotification(leaveData: {
  userName: string;
  startDate: Date;
  endDate: Date;
  leaveType: string;
  reason: string;
  isHalfDay: boolean;
  halfDayPeriod?: string;
}) {
  const { client, config } = await getSlackClient();
  
  if (!client || !config || !config.channel_id) {
    console.error('Slack client or channel not configured');
    return false;
  }
  
  const slackChannel = config.channel_id;

  try {
    const { userName, startDate, endDate, leaveType, reason, isHalfDay, halfDayPeriod } = leaveData;
    
    // Format dates
    const startDateStr = startDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
    
    let dateInfo;
    if (startDate.toDateString() === endDate.toDateString() && isHalfDay) {
      dateInfo = `${startDateStr} (${halfDayPeriod || 'Half Day'})`;
    } else if (startDate.toDateString() === endDate.toDateString()) {
      dateInfo = startDateStr;
    } else {
      const endDateStr = endDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      dateInfo = `${startDateStr} to ${endDateStr}`;
    }

    // Calculate number of days
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const dayCount = isHalfDay ? '0.5' : diffDays || 1;

    // Send message to Slack
    await client.chat.postMessage({
      channel: slackChannel,
      text: `New Leave Request`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🗓️ New Leave Request Submitted',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Employee:*\n${userName}`
            },
            {
              type: 'mrkdwn',
              text: `*Leave Type:*\n${leaveType}`
            }
          ]
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Date(s):*\n${dateInfo}`
            },
            {
              type: 'mrkdwn',
              text: `*Duration:*\n${dayCount} day${dayCount === 1 ? '' : 's'}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Reason:*\n${reason}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Status: *Pending Approval*'
            }
          ]
        }
      ]
    });

    return true;
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return false;
  }
}

// Send a summary of upcoming leave requests
export async function sendLeavesSummary() {
  try {
    const { client, config } = await getSlackClient();
    
    if (!client || !config || !config.channel_id) {
      console.error('Slack client or channel not configured');
      return false;
    }
    
    // Import models locally to avoid circular dependencies
    const Leave = require('../models/Leave').default;
    const User = require('../models/User').default;
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get date range (today plus configured number of days)
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (config.dayRange || 3));
    
    // Get all leave requests within the date range
    const leaves = await Leave.find({
      $or: [
        // Starts within range
        { startDate: { $gte: today, $lte: endDate } },
        // Ends within range
        { endDate: { $gte: today, $lte: endDate } },
        // Spans the entire range
        { startDate: { $lte: today }, endDate: { $gte: endDate } }
      ]
    }).populate({
      path: 'user',
      select: 'name email department'
    }).sort({ startDate: 1 });
    
    if (leaves.length === 0) {
      console.log('No upcoming leave requests found');
      return true;
    }
    
    // Format the message
    const leaveBlocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🗓️ Upcoming Leave Summary (Next ${config.dayRange} Days)`,
          emoji: true
        }
      },
      {
        type: 'divider'
      }
    ];
    
    // Add each leave to the message
    for (const leave of leaves) {
      const userName = leave.user?.name || 'Unknown';
      
      // Format dates
      const startDateStr = new Date(leave.startDate).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
      });
      
      const endDateStr = new Date(leave.endDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      
      let dateInfo;
      if (startDateStr === endDateStr) {
        dateInfo = startDateStr;
        if (leave.halfDay?.isHalfDay) {
          dateInfo += ` (${leave.halfDay.period || 'Half Day'})`;
        }
      } else {
        dateInfo = `${startDateStr} - ${endDateStr}`;
      }
      
      // For section blocks with fields, we need to explicitly type this according to Slack Block Kit types
      leaveBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${userName}* - ${leave.leaveType}: ${dateInfo}`
        }
      } as Record<string, unknown>); // Using Record<string, unknown> to bypass type checking - in a real app, add proper Slack Block Kit types
    }
    
    // Add footer
    leaveBlocks.push({
      type: 'context',
      text: {
        type: 'mrkdwn',
        text: `Generated at ${new Date().toLocaleString()}`
      }
    } as Record<string, unknown>); // Using Record<string, unknown> to bypass type checking - in a real app, add proper Slack Block Kit types
    
    // Send message to Slack
    await client.chat.postMessage({
      channel: config.channelId,
      text: `Leave Summary for Next ${config.dayRange} Days`,
      blocks: leaveBlocks
    });
    
    return true;
  } catch (error) {
    console.error('Error sending leave summary to Slack:', error);
    return false;
  }
}
