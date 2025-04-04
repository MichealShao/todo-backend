// Task ID migration script
require('dotenv').config();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Counter = require('../models/Counter');

async function migrateTaskIds() {
  try {
    // Connect to MongoDB
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Database connection successful');

    // Get all tasks sorted by creation time
    const tasks = await Task.find({}).sort({ createdAt: 1 });
    console.log(`Found ${tasks.length} tasks that need migration`);

    // Reset task ID counter
    await Counter.findOneAndUpdate(
      { name: 'task' },
      { value: 0 },
      { upsert: true }
    );

    // Assign ID to each task
    let counter = 0;
    for (const task of tasks) {
      counter++;
      // Skip tasks that already have IDs
      if (task.taskId) {
        console.log(`Task ${task._id} already has ID ${task.taskId}, skipping`);
        // Update counter to max value
        if (task.taskId > counter) {
          counter = task.taskId;
        }
        continue;
      }
      
      // Assign new ID
      task.taskId = counter;
      await task.save();
      console.log(`Task ${task._id} assigned ID: ${counter}`);
    }

    // Update counter to current max value
    await Counter.findOneAndUpdate(
      { name: 'task' },
      { value: counter },
      { upsert: true }
    );
    console.log(`Counter updated to current max value: ${counter}`);

    console.log('Task ID migration completed');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Execute migration
migrateTaskIds(); 