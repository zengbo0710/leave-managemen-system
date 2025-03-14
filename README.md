# Leave Management System

A comprehensive leave management application built with Next.js and Node.js that allows users to create and manage leave requests with Slack integration for notifications.

## Features

- User authentication and registration
- Create, view, update, and delete leave requests
- Support for half-day leave selection
- Calendar widget for date selection
- Automatic Slack notifications for new leave requests
- User roles (admin/employee)
- Department-based organization

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS, React DatePicker
- **Backend**: Next.js API Routes, MongoDB/Mongoose
- **Authentication**: JWT-based authentication
- **Integrations**: Slack notifications

## Getting Started

First, set up your environment variables:

```bash
# Create a .env.local file with the following variables
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_CHANNEL_ID=your_slack_channel_id
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
