const mongoose = require('mongoose');
const Counter = require('./Counter');

const TaskSchema = new mongoose.Schema({
  // Task ID (auto-incrementing)
  taskId: { 
    type: Number, 
    unique: true,
    required: true 
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  priority: { 
    type: String, 
    enum: ['High', 'Medium', 'Low'], 
    default: 'Medium',
    required: true 
  },
  deadline: { 
    type: Date, 
    required: true 
  },
  hours: { 
    type: Number, 
    required: true,
    min: 1 
  },
  details: { 
    type: String, 
    required: true 
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed', 'Expired'],
    default: 'Pending',
    required: true
  },
  // Start time field - null by default, only set when status is In Progress
  start_time: { 
    type: Date, 
    default: null 
  },
  createdAt: { type: Date, default: Date.now }
});

// Auto-generate task ID before saving
TaskSchema.pre('save', async function(next) {
  try {
    // Only generate ID for new tasks
    if (this.isNew) {
      // Get next task ID
      const taskId = await Counter.getNextValue('task');
      this.taskId = taskId;
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Task', TaskSchema);
