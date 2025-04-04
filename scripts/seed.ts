import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { users, leaves, slackConfigs } from '../src/lib/schema';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_OjPk20aDJstd@ep-proud-frost-a1bx9pnf-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

// Create database connection
const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

async function seed() {
  try {
    console.log('Seeding database...');

    // Hash passwords for sample users
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const employeePasswordHash = await bcrypt.hash('employee123', 10);

    // Insert sample users
    console.log('Adding sample users...');
    const insertedUsers = await db.insert(users).values([
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: adminPasswordHash,
        role: 'admin',
        department: 'Management'
      },
      {
        name: 'John Employee',
        email: 'john@example.com',
        password: employeePasswordHash,
        role: 'employee',
        department: 'Engineering'
      },
      {
        name: 'Sarah Employee',
        email: 'sarah@example.com',
        password: employeePasswordHash,
        role: 'employee',
        department: 'HR'
      }
    ]).returning();

    console.log(`Added ${insertedUsers.length} users`);

    // Set up a reference to users by email for easier reference in leave creation
    const userMap = insertedUsers.reduce((acc, user) => {
      acc[user.email] = user;
      return acc;
    }, {} as Record<string, typeof insertedUsers[0]>);

    // Insert sample leave requests
    console.log('Adding sample leave requests...');
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const nextWeekPlus1 = new Date(nextWeek);
    nextWeekPlus1.setDate(nextWeekPlus1.getDate() + 1);

    const insertedLeaves = await db.insert(leaves).values([
      {
        userId: userMap['john@example.com'].id,
        startDate: tomorrow,
        endDate: tomorrow,
        leaveType: 'Sick Leave',
        reason: 'Not feeling well',
        status: 'approved',
        approvedById: userMap['admin@example.com'].id,
        isHalfDay: false
      },
      {
        userId: userMap['sarah@example.com'].id,
        startDate: nextWeek,
        endDate: nextWeekPlus1,
        leaveType: 'Vacation',
        reason: 'Family trip',
        status: 'pending',
        isHalfDay: false
      }
    ]).returning();

    console.log(`Added ${insertedLeaves.length} leave requests`);

    // Insert slack configuration
    console.log('Adding Slack configuration...');
    const insertedConfig = await db.insert(slackConfigs).values({
      webhookUrl: 'https://hooks.slack.com/services/your-webhook-url',
      channelId: 'general',
      botToken: 'xoxb-your-bot-token',
      enabled: true
    }).returning();

    console.log(`Added Slack configuration`);

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
