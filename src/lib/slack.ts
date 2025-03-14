import { WebClient } from '@slack/web-api';

// Initialize the Slack Web Client (Token will be loaded from environment variables)
const slackToken = process.env.SLACK_BOT_TOKEN;
const slackChannel = process.env.SLACK_CHANNEL_ID;

let slackClient: WebClient | null = null;

if (slackToken) {
  slackClient = new WebClient(slackToken);
}

export async function sendLeaveNotification(leaveData: {
  userName: string;
  startDate: Date;
  endDate: Date;
  leaveType: string;
  reason: string;
  isHalfDay: boolean;
  halfDayPeriod?: string;
}) {
  if (!slackClient || !slackChannel) {
    console.error('Slack client or channel not configured');
    return false;
  }

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
    await slackClient.chat.postMessage({
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
              text: `*Leave Type:*\n${leaveType.charAt(0).toUpperCase() + leaveType.slice(1)} Leave`
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
