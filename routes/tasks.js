const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const mongoose = require('mongoose');

// Helper function to check if a task is expired
const checkTaskExpired = (task) => {
  const now = new Date();
  const deadline = new Date(task.deadline);
  return deadline < now && task.status !== 'Expired';
};

// Helper function to fix date timezone issues - 简化为直接返回原始日期
const fixDateTimezone = (dateString) => {
  if (!dateString) return null;
  return new Date(dateString);
};

// Helper function to validate start_time based on status
const validateStartTime = (status, start_time, oldStatus = null) => {
  // If status is Pending, start_time should be null
  if (status === 'Pending') {
    return null;
  }
  
  // If status is changing to In Progress, validate start_time
  if (status === 'In Progress') {
    // If start_time is provided, use it as is
    if (start_time) {
      return new Date(start_time);
    }
    // If no start_time provided when changing to In Progress, use current date
    else if (oldStatus !== 'In Progress') {
      return new Date();
    }
  }
  
  // If it's a direct update of start_time
  if (start_time !== undefined && start_time !== null && status !== 'Pending') {
    return new Date(start_time);
  }
  
  // For other cases, keep the existing start_time
  return start_time;
};

// Middleware to automatically update expired task status
const autoUpdateExpiredStatus = async (req, res, next) => {
  try {
    // Only execute this operation after user authentication
    if (req.user && req.user.id) {
      // Find all tasks with deadline passed but status not yet set to Expired
      const tasksToUpdate = await Task.find({
        user: req.user.id,
        deadline: { $lt: new Date() },
        status: { $ne: 'Expired' }
      });
      
      if (tasksToUpdate.length > 0) {
        console.log(`Found ${tasksToUpdate.length} expired tasks, updating status`);
        
        // Batch update these tasks to Expired status
        await Task.updateMany(
          { 
            _id: { $in: tasksToUpdate.map(t => t._id) },
            user: req.user.id
          },
          { $set: { status: 'Expired' } }
        );
      }
    }
    next();
  } catch (err) {
    console.error('Error updating expired status:', err);
    next(); // Continue processing the request even if update fails
  }
};

// Get tasks with pagination, sorting and filtering - GET /api/tasks
router.get('/', auth, autoUpdateExpiredStatus, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sortField = req.query.sortField || 'createdAt';
    const sortDirection = req.query.sortDirection || 'desc';
    
    // Added: Status filtering
    const statusFilter = req.query.status ? req.query.status.split(',') : null;
    
    const skip = (page - 1) * limit;
    
    // Build query conditions
    const query = { user: req.user.id };
    
    // Add status filter to query if provided
    if (statusFilter && statusFilter.length > 0) {
      query.status = { $in: statusFilter };
    }
    
    // Build sort object
    const sort = {};
    sort[sortField] = sortDirection === 'asc' ? 1 : -1;
    
    // Count total matching tasks
    const total = await Task.countDocuments(query);
    
    // Get paginated tasks
    const tasks = await Task.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);
      
    res.json({
      tasks,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get a single task by ID - GET /api/tasks/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) return res.status(404).json({ msg: 'Task not found' });
    
    // Check if task belongs to current user
    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    // Check if task needs to be updated to expired status
    if (checkTaskExpired(task)) {
      task.status = 'Expired';
      await task.save();
    }
    
    res.json(task);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Task not found' });
    }
    res.status(500).send('Server error');
  }
});

// Add a new task - POST /api/tasks
router.post('/', auth, async (req, res) => {
  const { priority, deadline, hours, details, status, start_time } = req.body;
  
  // Validate input
  if (!priority || !deadline || !hours || !details) {
    return res.status(400).json({ msg: 'Please provide all required fields' });
  }
  
  try {
    // Check if user is trying to create an already expired task
    let initialStatus = status || 'Pending';
    
    // 直接使用前端传入的deadline
    let deadlineDate = new Date(deadline);
    const now = new Date();
    
    // If deadline is in the past, automatically set to Expired
    if (deadlineDate < now) {
      initialStatus = 'Expired';
    } 
    // Prevent users from manually setting status to Expired
    else if (initialStatus === 'Expired') {
      initialStatus = 'Pending';
    }
    
    // 直接使用前端传入的start_time
    let taskStartTime = null;
    if (start_time && initialStatus !== 'Pending') {
      taskStartTime = new Date(start_time);
    } else if (initialStatus === 'In Progress' && !start_time) {
      taskStartTime = new Date();
    }
    
    const newTask = new Task({
      priority,
      deadline: deadlineDate,
      hours,
      details,
      status: initialStatus,
      start_time: taskStartTime,
      user: req.user.id
    });
    
    const task = await newTask.save();
    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Update a task - PUT /api/tasks/:id
router.put('/:id', auth, async (req, res) => {
  try {
    console.log('Update task request body:', req.body);
    
    // Extract all possible fields
    const { priority, deadline, hours, details, status, start_time } = req.body;
    
    // Find existing task
    let task = await Task.findById(req.params.id);
    
    if (!task) {
      console.log('Task not found:', req.params.id);
      return res.status(404).json({ msg: 'Task not found' });
    }
    
    // Ensure task belongs to current user
    if (task.user.toString() !== req.user.id) {
      console.log('Unauthorized access');
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    // Build task fields object
    const taskFields = {};
    if (priority) taskFields.priority = priority;
    if (hours) taskFields.hours = hours;
    if (details) taskFields.details = details;
    
    // 直接使用前端传入的deadline
    if (deadline) {
      taskFields.deadline = new Date(deadline);
    }
    
    // 直接处理start_time更新
    if (start_time !== undefined && task.status !== 'Pending') {
      console.log('Processing start_time update:', start_time);
      if (start_time) {
        taskFields.start_time = new Date(start_time);
      } else {
        if (task.status !== 'Pending') {
          console.log('Warning: Cannot set start_time to null for non-Pending tasks');
        } else {
          taskFields.start_time = null;
        }
      }
    }
    
    // Special handling for status field, prevent setting to Expired manually
    if (status !== undefined) {
      // If user tries to set status to Expired, ignore this operation
      if (status !== 'Expired') {
        taskFields.status = status;
        console.log('Will update status field to:', status);
        
        // Handle start_time based on status change
        if (start_time === undefined) {
          if (status === 'Pending') {
            taskFields.start_time = null;
          } else if (status === 'In Progress' && task.status !== 'In Progress') {
            taskFields.start_time = new Date();
          }
        }
      } else {
        console.log('User tried to set task status to Expired manually, ignored');
      }
    }
    
    console.log('Update fields:', taskFields);
    
    // Check deadline, if a new deadline is set, check if it's already expired
    if (deadline) {
      const deadlineDate = new Date(taskFields.deadline);
      const now = new Date();
      
      if (deadlineDate < now) {
        // If new deadline is in the past, automatically set to Expired
        taskFields.status = 'Expired';
        console.log('New deadline is in the past, automatically setting status to Expired');
      }
    } else {
      // If deadline isn't updated, check if existing deadline is expired
      const existingDeadline = new Date(task.deadline);
      const now = new Date();
      
      if (existingDeadline < now && task.status !== 'Expired') {
        taskFields.status = 'Expired';
        console.log('Existing deadline is in the past, automatically setting status to Expired');
      }
    }

    // Use findOneAndUpdate instead of findByIdAndUpdate
    task = await Task.findOneAndUpdate(
      { _id: req.params.id },
      { $set: taskFields },
      { new: true, runValidators: true }
    );
    
    console.log('Updated task:', task);
    res.json(task);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).send('Server error: ' + err.message);
  }
});

// Batch update task status - PUT /api/tasks/batch-update/status
router.put('/batch-update/status', auth, async (req, res) => {
  const { taskIds, status } = req.body;
  
  // Validate input
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0 || !status) {
    return res.status(400).json({ msg: 'Please provide valid task ID array and status' });
  }
  
  // Prevent batch setting status to Expired
  if (status === 'Expired') {
    return res.status(400).json({ msg: 'Not allowed to manually set tasks to Expired status' });
  }
  
  try {
    // Validate status value
    const validStatuses = ['Pending', 'In Progress', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: 'Invalid status value' });
    }
    
    // Find tasks that belong to current user
    const tasks = await Task.find({
      _id: { $in: taskIds },
      user: req.user.id
    });
    
    // If no tasks found, return error
    if (tasks.length === 0) {
      return res.status(404).json({ msg: 'No specified tasks found' });
    }
    
    // Get IDs of tasks found
    const foundTaskIds = tasks.map(task => task._id);
    
    // For Pending status, reset start_time to null
    if (status === 'Pending') {
      await Task.updateMany(
        { _id: { $in: foundTaskIds } },
        { $set: { status, start_time: null } }
      );
    } 
    // For In Progress status, set start_time to current date if not already set
    else if (status === 'In Progress') {
      const now = new Date();
      
      // Individual update to handle start_time correctly
      for (const taskId of foundTaskIds) {
        const task = await Task.findById(taskId);
        // Only set start_time if changing from a status that's not In Progress
        if (task.status !== 'In Progress') {
          // 直接使用当前日期，不做额外处理
          await Task.updateOne(
            { _id: taskId },
            { $set: { status, start_time: now } }
          );
        } else {
          // If already In Progress, just update status
          await Task.updateOne(
            { _id: taskId },
            { $set: { status } }
          );
        }
      }
    } else {
      // For other statuses (Completed), keep start_time unchanged
      await Task.updateMany(
        { _id: { $in: foundTaskIds } },
        { $set: { status } }
      );
    }
    
    res.json({ 
      msg: 'Task status updated',
      updatedTasks: foundTaskIds,
      status
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Delete a task - DELETE /api/tasks/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    console.log('Processing delete request, task ID:', req.params.id);
    console.log('Current user ID:', req.user.id);
    
    // Use ID string directly without trying to convert to ObjectId
    const taskId = req.params.id;
    
    // Use findById which is simpler and reliable
    let task = await Task.findById(taskId);
    
    if (!task) {
      console.log('Task not found:', req.params.id);
      return res.status(404).json({ msg: 'Task not found' });
    }
    
    console.log('Found task:', task);
    console.log('Task owner ID:', task.user.toString());
    
    // Ensure task belongs to user
    if (task.user.toString() !== req.user.id) {
      console.log('User not authorized to delete this task');
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    console.log('Starting task deletion...');
    
    // Use findByIdAndDelete method
    const result = await Task.findByIdAndDelete(taskId);
    
    if (!result) {
      console.log('Delete operation did not delete any document');
      return res.status(404).json({ msg: 'Delete failed, task may have been already deleted' });
    }
    
    console.log('Task deleted successfully, result:', result);
    res.json({ msg: 'Task deleted' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;
