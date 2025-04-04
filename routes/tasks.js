const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const mongoose = require('mongoose');

// Helper function to check if a task is expired
const checkTaskExpired = (task) => {
  // 获取客户端本地时间（使用服务器时间作为估计）
  const now = new Date();
  
  // 创建今天日期加上宽限期（凌晨4点）- 使用本地日期
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // 如果当前时间小于凌晨4点，则使用昨天的日期加上宽限期
  if (now.getHours() < 4) {
    todayDate.setDate(todayDate.getDate() - 1);
  }
  // 设置宽限期为凌晨4点
  todayDate.setHours(4, 0, 0, 0);
  
  // 获取任务截止日期（去掉时间部分）
  const deadline = new Date(task.deadline);
  const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  // 设置截止日期为当天的凌晨4点
  deadlineDate.setHours(4, 0, 0, 0);
  
  // 只有截止日期严格早于今天的凌晨4点（不包括今天）且状态不是Expired，才算作过期
  console.log('Checking expiration: deadline date:', deadlineDate, 'today with grace period:', todayDate);
  return deadlineDate < todayDate && task.status !== 'Expired';
};

// Helper function to validate start_time based on status
const validateStartTime = (status, start_time, oldStatus = null) => {
  const now = new Date();
  
  // If start_time is provided, validate it
  if (start_time !== undefined && start_time !== null) {
    const startDate = new Date(start_time);
    
    // Fix timezone issue - use the exact date selected by user
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1; // Month needs +1 to get real month (1-12)
    const startDay = startDate.getDate();
    
    // Check if the date is today
    const isStartDateToday = 
      startYear === now.getFullYear() && 
      startMonth === now.getMonth() + 1 && 
      startDay === now.getDate();
    
    // If it's today, use current time
    if (isStartDateToday) {
      return now;
    }
    
    // Otherwise, set to noon (12:00) in UTC
    const startDateStr = `${startYear}-${startMonth.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}T12:00:00.000Z`;
    return new Date(startDateStr);
  }
  
  // If status is changing to In Progress and no start_time provided
  if (status === 'In Progress' && oldStatus !== 'In Progress') {
    return now;
  }
  
  // For other cases, keep the existing start_time
  return start_time;
};

// Helper function to process date with timezone consideration
const processDate = (date, isToday = false) => {
  const inputDate = new Date(date);
  const now = new Date();
  
  // Get date parts
  const year = inputDate.getFullYear();
  const month = inputDate.getMonth() + 1; // Month needs +1 to get real month (1-12)
  const day = inputDate.getDate();
  
  // Check if the date is today
  const isInputDateToday = 
    year === now.getFullYear() && 
    month === now.getMonth() + 1 && 
    day === now.getDate();
  
  // If it's today and isToday flag is true, use current time
  if (isToday && isInputDateToday) {
    return now;
  }
  
  // Otherwise, set to noon (12:00) in UTC
  const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T12:00:00.000Z`;
  return new Date(dateStr);
};

// Middleware to automatically update expired task status
const autoUpdateExpiredStatus = async (req, res, next) => {
  try {
    // Only execute this operation after user authentication
    if (req.user && req.user.id) {
      // 获取本地时间（使用服务器时间作为估计）
      const now = new Date();
      
      // 获取今天的日期并添加宽限期（凌晨4点）
      const todayDate = new Date();
      // 如果当前时间小于凌晨4点，则使用昨天的日期加上宽限期
      if (now.getHours() < 4) {
        todayDate.setDate(todayDate.getDate() - 1);
      }
      // 设置为凌晨4点
      todayDate.setHours(4, 0, 0, 0);
      
      console.log('Current date for expiration check with grace period (4am):', todayDate);
      
      // 查找所有截止日期已过但状态尚未设置为已过期的任务
      const tasksToUpdate = await Task.find({
        user: req.user.id,
        deadline: { $lt: todayDate }, // 使用今天日期加宽限期（凌晨4点）进行比较
        status: { $ne: 'Expired' }
      });
      
      if (tasksToUpdate.length > 0) {
        console.log(`Found ${tasksToUpdate.length} expired tasks, updating status`);
        
        // 批量更新这些任务为已过期状态
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
    next(); // 即使更新失败，也继续处理请求
  }
};

// Get tasks with pagination, sorting and filtering - GET /api/tasks
router.get('/', auth, autoUpdateExpiredStatus, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sortField = req.query.sortField || 'createdAt';
    const sortDirection = req.query.sortDirection || 'desc';
    
    // 添加筛选条件
    const statusFilter = req.query.status ? req.query.status.split(',') : null;
    const priorityFilter = req.query.priority ? req.query.priority.split(',') : null;
    
    const skip = (page - 1) * limit;
    
    // Build query conditions
    const query = { user: req.user.id };
    
    // 添加状态筛选条件
    if (statusFilter && statusFilter.length > 0) {
      query.status = { $in: statusFilter };
    }
    
    // 添加优先级筛选条件
    if (priorityFilter && priorityFilter.length > 0) {
      query.priority = { $in: priorityFilter };
    }
    
    console.log('Query conditions:', query);
    
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
  try {
    console.log('Creating new task with body:', JSON.stringify(req.body));
    
    const { priority, deadline, hours, details, status, start_time } = req.body;
    
    // Validate input
    if (!priority || !deadline || !hours || !details) {
      console.log('Missing required fields:', { priority, deadline, hours, details });
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }
    
    // Check if user is trying to create an already expired task
    let initialStatus = status || 'Pending';
    
    // Process deadline with timezone consideration
    let deadlineDate = processDate(deadline, true);
    
    // Get local time
    const now = new Date();
    
    // Get today's date with grace period (4am)
    const todayDate = new Date();
    // If current time is before 4am, use yesterday's date plus grace period
    if (now.getHours() < 4) {
      todayDate.setDate(todayDate.getDate() - 1);
    }
    // Set to 4am
    todayDate.setHours(4, 0, 0, 0);
    
    // Get deadline date (without time part)
    const deadlineDateOnly = new Date(deadlineDate);
    // Set to 4am on deadline date
    deadlineDateOnly.setHours(4, 0, 0, 0);
    
    console.log('Today date with grace period (4am) for task creation:', todayDate);
    console.log('Deadline date with grace period (4am) for comparison:', deadlineDateOnly);
    
    // Only set to expired if deadline is strictly before today's 4am (not including today)
    if (deadlineDateOnly < todayDate) {
      initialStatus = 'Expired';
      console.log('Task marked as expired because deadline is in the past (before 4am grace period)');
    } 
    // Prevent users from manually setting status to Expired
    else if (initialStatus === 'Expired') {
      initialStatus = 'Pending';
    }
    
    // Process start_time with timezone consideration
    let fixedStartTime = null;
    if (start_time !== undefined && start_time !== null) {
      fixedStartTime = processDate(start_time, true);
      console.log('Fixed start_time:', fixedStartTime);
    } else if (initialStatus === 'In Progress') {
      // If status is In Progress but no start_time provided, use current time
      fixedStartTime = new Date();
    }
    
    console.log('Creating new task with fields:', {
      priority,
      deadline: deadlineDate,
      hours,
      details: details?.substring(0, 20) + '...',
      status: initialStatus,
      start_time: fixedStartTime,
      user: req.user.id
    });
    
    const newTask = new Task({
      priority,
      deadline: deadlineDate,
      hours,
      details,
      status: initialStatus,
      start_time: fixedStartTime,
      user: req.user.id
    });
    
    console.log('Saving new task...');
    const task = await newTask.save();
    console.log('Task saved successfully with ID:', task._id, 'and taskId:', task.taskId);
    
    res.json(task);
  } catch (err) {
    console.error('Error creating task:', err);
    
    // Check for specific MongoDB errors
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(error => error.message);
      console.error('Validation errors:', validationErrors);
      return res.status(400).json({ 
        msg: 'Validation error', 
        errors: validationErrors
      });
    }
    
    if (err.code === 11000) {
      console.error('Duplicate key error:', err.keyValue);
      return res.status(400).json({ 
        msg: 'Duplicate key error', 
        field: Object.keys(err.keyValue)[0]
      });
    }
    
    res.status(500).json({
      msg: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
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
    
    // Process deadline with timezone consideration
    if (deadline) {
      taskFields.deadline = processDate(deadline, true);
    }
    
    // Process start_time with timezone consideration
    if (start_time !== undefined) {
      console.log('Directly processing start_time update:', start_time);
      try {
        if (start_time === null) {
          // If explicitly set to null
          taskFields.start_time = null;
          console.log('Setting start_time to null');
        } else {
          taskFields.start_time = processDate(start_time, true);
          console.log('New start_time set to:', taskFields.start_time);
        }
      } catch (error) {
        console.error('Error processing start_time:', error);
        return res.status(400).json({ msg: 'Invalid start_time format' });
      }
    }
    
    // Special handling for status field, prevent setting to Expired manually
    if (status !== undefined) {
      // If user tries to set status to Expired, ignore this operation
      if (status !== 'Expired') {
        taskFields.status = status;
        console.log('Will update status field to:', status);
        
        // Handle start_time based on status change
        try {
          // Only automatically set start_time through status change if not explicitly provided
          if (start_time === undefined) {
            const validatedStartTime = validateStartTime(status, task.start_time, task.status);
            taskFields.start_time = validatedStartTime;
            console.log('Validated start_time from status change:', validatedStartTime);
          }
        } catch (error) {
          return res.status(400).json({ msg: error.message });
        }
      } else {
        console.log('User tried to set task status to Expired manually, ignored');
      }
    }
    
    console.log('Update fields:', taskFields);
    
    // Check deadline, if a new deadline is set, check if it's already expired
    if (deadline) {
      // 获取本地时间
      const now = new Date();
      
      // 获取今天的日期并添加宽限期（凌晨4点）
      const todayDate = new Date();
      // 如果当前时间小于凌晨4点，则使用昨天的日期加上宽限期
      if (now.getHours() < 4) {
        todayDate.setDate(todayDate.getDate() - 1);
      }
      // 设置为凌晨4点
      todayDate.setHours(4, 0, 0, 0);
      
      // 获取新截止日期并添加宽限期（凌晨4点）
      const deadlineDate = new Date(taskFields.deadline);
      // 设置为截止日期的凌晨4点
      const deadlineDateOnly = new Date(deadlineDate);
      deadlineDateOnly.setHours(4, 0, 0, 0);
      
      // 只有当截止日期严格早于今天的凌晨4点（不包括今天）时，才自动设置为已过期
      if (deadlineDateOnly < todayDate) {
        // If new deadline is strictly before today (with grace period), automatically set to Expired
        taskFields.status = 'Expired';
        console.log('New deadline is in the past (before 4am grace period), automatically setting status to Expired');
      }
    } else {
      // If deadline isn't updated, check if existing deadline is expired
      // 获取本地时间
      const now = new Date();
      
      // 获取今天的日期并添加宽限期（凌晨4点）
      const todayDate = new Date();
      // 如果当前时间小于凌晨4点，则使用昨天的日期加上宽限期
      if (now.getHours() < 4) {
        todayDate.setDate(todayDate.getDate() - 1);
      }
      // 设置为凌晨4点
      todayDate.setHours(4, 0, 0, 0);
      
      // 获取现有截止日期并添加宽限期（凌晨4点）
      const existingDeadline = new Date(task.deadline);
      // 设置为截止日期的凌晨4点
      const existingDeadlineDateOnly = new Date(existingDeadline);
      existingDeadlineDateOnly.setHours(4, 0, 0, 0);
      
      // 只有当截止日期严格早于今天的凌晨4点（不包括今天）时，才自动设置为已过期
      if (existingDeadlineDateOnly < todayDate && task.status !== 'Expired') {
        taskFields.status = 'Expired';
        console.log('Existing deadline is in the past (before 4am grace period), automatically setting status to Expired');
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
      // Individual update to handle start_time correctly
      for (const taskId of foundTaskIds) {
        const task = await Task.findById(taskId);
        // Only set start_time if changing from a status that's not In Progress
        if (task.status !== 'In Progress') {
          // Use current time for start_time
          const currentTime = new Date();
          
          await Task.updateOne(
            { _id: taskId },
            { $set: { status, start_time: currentTime } }
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
