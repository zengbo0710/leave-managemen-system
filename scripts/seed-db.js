const { MongoClient } = require('mongodb');
import bcrypt from 'bcryptjs';
const { ObjectId } = require('mongodb');

// Connection URL
const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);

// Database Name
const dbName = 'leave-management';

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB server');
    
    const db = client.db(dbName);
    
    // Clear existing collections
    await db.collection('users').deleteMany({});
    await db.collection('leaves').deleteMany({});
    
    console.log('Cleared existing collections');
    
    // Create admin user
    const adminId = new ObjectId();
    const adminPassword = 'admin123';
    const adminSalt = await bcrypt.genSalt(10);
    const adminHashedPassword = await bcrypt.hash(adminPassword, adminSalt);
    
    await db.collection('users').insertOne({
      _id: adminId,
      name: 'Admin User',
      email: 'admin@example.com',
      password: adminHashedPassword,
      role: 'admin',
      department: 'Management',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('Created admin user:');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');
    
    // Create employee user
    const employeeId = new ObjectId();
    const employeePassword = 'employee123';
    const employeeSalt = await bcrypt.genSalt(10);
    const employeeHashedPassword = await bcrypt.hash(employeePassword, employeeSalt);
    
    await db.collection('users').insertOne({
      _id: employeeId,
      name: 'Employee User',
      email: 'employee@example.com',
      password: employeeHashedPassword,
      role: 'employee',
      department: 'Engineering',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('\nCreated employee user:');
    console.log('Email: employee@example.com');
    console.log('Password: employee123');
    
    // Create leave requests
    const leaveTypes = ['Annual', 'Sick', 'Personal', 'Paternity', 'Maternity', 'Work From Home', 'Training', 'Conference', 'Bereavement'];
    const statuses = ['pending', 'approved', 'rejected'];
    
    // Create a few leave requests for the employee
    const now = new Date();
    const leaves = [
      {
        user: employeeId,
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5),
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7),
        leaveType: 'Annual',
        halfDay: {
          isHalfDay: false,
          period: null
        },
        reason: 'Family vacation',
        status: 'pending',
        slackNotificationSent: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        user: employeeId,
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 15),
        endDate: new Date(now.getFullYear(), now.getMonth() - 1, 16),
        leaveType: 'Sick',
        halfDay: {
          isHalfDay: false,
          period: null
        },
        reason: 'Not feeling well',
        status: 'approved',
        approvedBy: adminId,
        slackNotificationSent: true,
        createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 14),
        updatedAt: new Date(now.getFullYear(), now.getMonth() - 1, 14)
      },
      {
        user: employeeId,
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15),
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15),
        leaveType: 'Work From Home',
        halfDay: {
          isHalfDay: true,
          period: 'morning'
        },
        reason: 'Personal appointment',
        status: 'pending',
        slackNotificationSent: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    await db.collection('leaves').insertMany(leaves);
    console.log('\nCreated sample leave requests');
    
    console.log('\nDatabase seeding completed successfully!');
    console.log('You can now log in with the following credentials:');
    console.log('Admin User: admin@example.com / admin123');
    console.log('Employee User: employee@example.com / employee123');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Run the seed function
seedDatabase();
