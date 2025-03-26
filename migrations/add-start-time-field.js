/**
 * Migration Script - Add start_time field to existing tasks
 * 
 * Usage:
 * 1. Ensure MongoDB connection is working properly
 * 2. Execute: node migrations/add-start-time-field.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Task = require('../models/Task');

// Connect to database
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected, starting migration...'))
.catch(err => {
  console.error('Database connection failed:', err.message);
  process.exit(1);
});

async function migrateData() {
  try {
    // Find all tasks without start_time field or with null start_time
    const tasksToUpdate = await Task.find({
      $or: [
        { start_time: { $exists: false } },
        { start_time: null }
      ]
    });

    console.log(`Found ${tasksToUpdate.length} tasks that need updating`);

    if (tasksToUpdate.length === 0) {
      console.log('No tasks need migration');
      mongoose.disconnect();
      return;
    }

    // Update tasks based on their status
    let pendingCount = 0;
    let inProgressCount = 0;
    let otherCount = 0;

    for (const task of tasksToUpdate) {
      if (task.status === 'Pending') {
        // For Pending tasks, set start_time to null
        await Task.updateOne(
          { _id: task._id },
          { $set: { start_time: null } }
        );
        pendingCount++;
      } else if (task.status === 'In Progress') {
        // For In Progress tasks, set start_time to current date
        await Task.updateOne(
          { _id: task._id },
          { $set: { start_time: new Date() } }
        );
        inProgressCount++;
      } else {
        // For Completed and Expired tasks, set start_time to one day after creation date
        const createdAt = task.createdAt || new Date();
        const estimatedStartTime = new Date(createdAt);
        estimatedStartTime.setDate(estimatedStartTime.getDate() + 1);
        
        await Task.updateOne(
          { _id: task._id },
          { $set: { start_time: estimatedStartTime } }
        );
        otherCount++;
      }
    }

    console.log(`Migration completed!`);
    console.log(`- ${pendingCount} Pending tasks updated with null start_time`);
    console.log(`- ${inProgressCount} In Progress tasks updated with current date`);
    console.log(`- ${otherCount} other status tasks updated with estimated start_time`);
  } catch (error) {
    console.error('Error occurred during migration:', error);
  } finally {
    mongoose.disconnect();
  }
}

migrateData(); 