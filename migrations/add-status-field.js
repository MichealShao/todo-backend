/**
 * Migration Script - Add status field to existing tasks
 * 
 * Usage:
 * 1. Ensure MongoDB connection is working properly
 * 2. Execute: node migrations/add-status-field.js
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
    // Find all tasks without status field or with null status
    const tasksToUpdate = await Task.find({
      $or: [
        { status: { $exists: false } },
        { status: null }
      ]
    });

    console.log(`Found ${tasksToUpdate.length} tasks that need updating`);

    if (tasksToUpdate.length === 0) {
      console.log('No tasks need migration');
      mongoose.disconnect();
      return;
    }

    // Update these tasks, setting status to "Pending"
    const updateResult = await Task.updateMany(
      {
        $or: [
          { status: { $exists: false } },
          { status: null }
        ]
      },
      {
        $set: { status: 'Pending' }
      }
    );

    console.log(`Successfully updated ${updateResult.nModified} tasks`);
    console.log('Migration completed!');
  } catch (error) {
    console.error('Error occurred during migration:', error);
  } finally {
    mongoose.disconnect();
  }
}

migrateData(); 