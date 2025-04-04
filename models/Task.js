const mongoose = require('mongoose');
const Counter = require('./Counter');

const TaskSchema = new mongoose.Schema({
  // 任务ID（自动递增）
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

// 保存前自动生成任务ID
TaskSchema.pre('save', async function(next) {
  try {
    // 只有在新建任务时才生成ID
    if (this.isNew) {
      // 获取下一个任务ID
      const taskId = await Counter.getNextValue('task');
      this.taskId = taskId;
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Task', TaskSchema);
