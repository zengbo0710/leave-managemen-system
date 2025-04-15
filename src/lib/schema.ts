import { pgTable, serial, varchar, timestamp, boolean, pgEnum, text } from 'drizzle-orm/pg-core';

// Enum for user roles
export const roleEnum = pgEnum('role', ['admin', 'employee']);

// Enum for leave status
export const statusEnum = pgEnum('status', ['pending', 'approved', 'rejected']);

// Enum for half-day period
export const periodEnum = pgEnum('period', ['morning', 'afternoon']);

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: roleEnum('role').default('employee').notNull(),
  department: varchar('department', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Leave table
export const leaves = pgTable('leaves', {
  id: serial('id').primaryKey(),
  userId: serial('user_id').references(() => users.id).notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  leaveType: varchar('leave_type', { length: 100 }).notNull(),
  isHalfDay: boolean('is_half_day').default(false).notNull(),
  period: periodEnum('period'),
  reason: text('reason'),
  status: statusEnum('status').default('pending').notNull(),
  approvedById: serial('approved_by_id').references(() => users.id),
  slackNotificationSent: boolean('slack_notification_sent').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Slack configuration table
export const slackConfigs = pgTable('slack_configs', {
  id: serial('id').primaryKey(),
  webhookUrl: varchar('webhook_url', { length: 255 }),
  channelId: varchar('channel_id', { length: 100 }),
  botToken: varchar('bot_token', { length: 255 }),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Google OAuth Credentials table
export const googleCredentials = pgTable('google_credentials', {
  id: serial('id').primaryKey(),
  clientId: text('client_id').notNull(),
  clientSecret: text('client_secret').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Leave = typeof leaves.$inferSelect;
export type NewLeave = typeof leaves.$inferInsert;

export type SlackConfig = typeof slackConfigs.$inferSelect;
export type NewSlackConfig = typeof slackConfigs.$inferInsert;

export type GoogleCredential = typeof googleCredentials.$inferSelect;
export type NewGoogleCredential = typeof googleCredentials.$inferInsert;
