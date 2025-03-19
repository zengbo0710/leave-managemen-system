const { MongoClient } = require('mongodb');

// Connection URL
const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);

// Database Name
const dbName = 'leave-management';

async function initSlackConfig() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB server');
    
    const db = client.db(dbName);
    
    // Check if slack config exists
    const existingConfig = await db.collection('slackconfigs').findOne({});
    
    if (!existingConfig) {
      // Create initial slack config
      await db.collection('slackconfigs').insertOne({
        token: '',
        channelId: '',
        enabled: true,
        dayRange: 3,
        scheduleEnabled: true,
        scheduleTime: '08:30',
        scheduleWorkdaysOnly: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('Created initial Slack configuration');
    } else {
      console.log('Slack configuration already exists');
    }
    
  } catch (error) {
    console.error('Error initializing Slack configuration:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Run the initialization function
initSlackConfig();
