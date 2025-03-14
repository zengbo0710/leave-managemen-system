# Slack Notifications System

The Leave Management System includes integration with Slack to send automated notifications about leave requests. This document explains how to configure and use this feature.

## Features

- **Real-time notifications**: Receive notifications when leave requests are created, updated, or deleted
- **Daily summaries**: Receive daily summaries of upcoming leaves
- **Configurable schedule**: Choose when daily summaries are sent, defaulting to workdays at 8:30 AM
- **Admin interface**: Easily manage Slack configurations via the admin panel

## Configuration

### Admin Setup

1. Navigate to the Slack Configuration page via the Admin dashboard
2. Enter your Slack Bot Token and Channel ID
3. Configure notification settings:
   - Enable/disable Slack notifications
   - Set the day range for leave summaries (1-30 days)
   - Enable/disable scheduled summaries
   - Set the time for daily summaries (default: 8:30 AM)
   - Choose to send only on workdays (Monday-Friday) or every day

### Technical Setup

For the scheduled notifications to work, you need to run the cron job script:

```bash
# Install dependencies
npm install

# Run the cron job setup script
npm run setup-cron
```

This will start a process that checks every 5 minutes whether it's time to send the daily summary. The script must be kept running for scheduled notifications to work.

In a production environment, you should:

1. Use a process manager like PM2 to keep the cron job running:
   ```bash
   npm install -g pm2
   pm2 start scripts/setup-cron.js --name "leave-system-cron"
   ```

2. Ensure your `.env` file contains the following variables:
   ```
   NEXT_PUBLIC_BASE_URL=https://your-application-url.com
   CRON_SECRET_TOKEN=your-secret-token  # Will be auto-generated if not provided
   SLACK_CHECK_INTERVAL="*/5 * * * *"   # Cron schedule (default: every 5 minutes)
   ```

## How It Works

The system sends two types of Slack notifications:

1. **Real-time notifications**: When leaves are created, updated, or deleted, notifications are sent immediately if Slack integration is enabled.

2. **Scheduled daily summaries**: At the configured time (default: 8:30 AM on workdays), a summary of upcoming leaves is sent to the configured Slack channel. The summary includes:
   - Leave requests starting or active in the next X days (configurable, default: 3 days)
   - Employee names and leave types
   - Leave dates

## Troubleshooting

If notifications aren't being sent:

1. Check the Slack configuration in the admin panel
2. Ensure the cron job is running (`npm run setup-cron`)
3. Verify the Slack Bot token has the necessary permissions:
   - `chat:write`
   - `channels:read` (for public channels)
   - `groups:read` (for private channels)
4. Check server logs for any errors related to Slack API calls

## Security Considerations

- Slack tokens are stored securely in the database and masked in the UI
- The cron endpoint is protected with a secret token
- Only admin users can configure Slack settings
