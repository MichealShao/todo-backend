const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
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

module.exports = mongoose.model('Task', TaskSchema);
