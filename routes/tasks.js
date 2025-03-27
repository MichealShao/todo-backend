const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const verifyTaskOwnership = require('../middleware/taskOwnership');
const dateUtils = require('../utils/dateUtils');
const taskUtils = require('../utils/taskUtils');
const logger = require('../utils/logger');
const responseHandler = require('../utils/responseHandler');

// Helper function to check if a task is expired
const checkTaskExpired = (task) => {
  // 获取当前日期（去除时间部分）
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // 获取任务截止日期（去除时间部分）
  const deadline = new Date(task.deadline);
  const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  
  // 只有当截止日期严格早于今天（不包括今天）才视为过期
  return deadlineDate < todayDate && task.status !== 'Expired';
};

// Helper function to validate start_time based on status
const validateStartTime = (status, start_time, oldStatus = null) => {
  const now = new Date();
  
  // If status is Pending, start_time should be null
  if (status === 'Pending') {
    return null;
  }
  
  // If status is changing to In Progress, validate start_time
  if (status === 'In Progress') {
    // If start_time is provided, check if it's not earlier than today
    if (start_time) {
      const startDate = new Date(start_time);
      
      // 修复时区问题 - 使用用户选择的确切日期
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1; // 月份需要+1才是真实月份(1-12)
      const startDay = startDate.getDate();
      
      // Reset time part for date comparison (比较日期时忽略时间部分)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      
      if (startDateOnly < todayStart) {
        throw new Error('Start time cannot be earlier than today');
      }
      
      // 使用ISO字符串创建新日期，固定为中午12:00，避免时区问题
      // 格式: YYYY-MM-DDT12:00:00Z (Z表示UTC时区)
      const startDateStr = `${startYear}-${startMonth.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}T12:00:00.000Z`;
      return new Date(startDateStr);
    }
    // If no start_time provided when changing to In Progress, use current date
    else if (oldStatus !== 'In Progress') {
      // 创建新日期，使用今天的日期，时间设为12:00（中午）
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1; // 月份需要+1才是真实月份(1-12)
      const day = currentDate.getDate();
      
      // 使用ISO字符串创建新日期
      const todayDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T12:00:00.000Z`;
      return new Date(todayDateStr);
    }
  }
  
  // If it's a direct update of start_time (not through status change)
  if (start_time !== undefined && start_time !== null && status !== 'Pending') {
    const startDate = new Date(start_time);
    
    // 修复时区问题 - 使用用户选择的确切日期
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1; // 月份需要+1才是真实月份(1-12)
    const startDay = startDate.getDate();
    
    // 使用ISO字符串创建新日期
    const startDateStr = `${startYear}-${startMonth.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}T12:00:00.000Z`;
    return new Date(startDateStr);
  }
  
  // For Completed and Expired status, keep the existing start_time
  return start_time;
};

// Middleware to automatically update expired task status
const autoUpdateExpiredStatus = async (req, res, next) => {
  try {
    // Only execute this operation after user authentication
    if (req.user && req.user.id) {
      await taskUtils.updateExpiredTasksForUser(req.user.id);
    }
    next();
  } catch (err) {
    logger.error('Error updating expired status', err);
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
    
    // Status filtering
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
      
    return responseHandler.success(res, {
      tasks,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error('Error getting tasks', err);
    return responseHandler.error(res, 'Server error', 500, err);
  }
});

// Get a single task by ID - GET /api/tasks/:id
router.get('/:id', auth, verifyTaskOwnership, async (req, res) => {
  try {
    // Task is already available in req.task from verifyTaskOwnership middleware
    const task = req.task;
    
    // Check if task needs to be updated to expired status
    if (taskUtils.isTaskExpired(task)) {
      task.status = 'Expired';
      await task.save();
    }
    
    return responseHandler.success(res, task);
  } catch (err) {
    logger.error('Error getting task details', err);
    return responseHandler.error(res, 'Server error', 500, err);
  }
});

// Add a new task - POST /api/tasks
router.post('/', auth, async (req, res) => {
  const { priority, deadline, hours, details, status, start_time } = req.body;
  
  // Validate input
  if (!priority || !deadline || !hours || !details) {
    return responseHandler.validationError(res, 'Please provide all required fields');
  }
  
  try {
    // Check if user is trying to create an already expired task
    let initialStatus = status || 'Pending';
    
    // Fix timezone issues - handle deadline to preserve user's selected date
    let deadlineDate = dateUtils.createFixedDate(deadline);
    
    // If deadline is strictly before today, automatically set to Expired
    if (dateUtils.isBeforeToday(deadlineDate)) {
      initialStatus = 'Expired';
    } 
    // Prevent users from manually setting status to Expired
    else if (initialStatus === 'Expired') {
      initialStatus = 'Pending';
    }
    
    // Process start_time based on task status
    let fixedStartTime = null;
    if (start_time && initialStatus !== 'Pending') {
      fixedStartTime = dateUtils.createFixedDate(start_time);
      logger.debug('Fixed start_time', fixedStartTime);
    } else if (initialStatus === 'In Progress' && !start_time) {
      // If status is In Progress but no start_time provided, use current time
      fixedStartTime = dateUtils.createFixedDate(new Date());
    }
    
    const newTask = new Task({
      priority,
      deadline: deadlineDate, // Use fixed deadline date
      hours,
      details,
      status: initialStatus,
      start_time: fixedStartTime,
      user: req.user.id
    });
    
    const task = await newTask.save();
    return responseHandler.success(res, task, 'Task created successfully', 201);
  } catch (err) {
    logger.error('Error creating task', err);
    return responseHandler.error(res, 'Server error', 500, err);
  }
});

// Update a task - PUT /api/tasks/:id
router.put('/:id', auth, verifyTaskOwnership, async (req, res) => {
  try {
    logger.debug('Update task request body', req.body);
    
    // Task is already available in req.task from verifyTaskOwnership middleware
    const task = req.task;
    const updateFields = req.body;
    
    // Validate and process update fields
    const taskFields = taskUtils.validateTaskUpdate(task, updateFields);
    
    logger.debug('Processed update fields', taskFields);
    
    // Use findOneAndUpdate for atomicity
    const updatedTask = await Task.findOneAndUpdate(
      { _id: req.params.id },
      { $set: taskFields },
      { new: true, runValidators: true }
    );
    
    logger.debug('Updated task', updatedTask);
    return responseHandler.success(res, updatedTask);
  } catch (err) {
    logger.error('Error updating task', err);
    
    if (err.message.includes('Start time cannot be earlier than today')) {
      return responseHandler.validationError(res, err.message);
    }
    
    return responseHandler.error(res, 'Server error', 500, err);
  }
});

// Batch update task status - PUT /api/tasks/batch-update/status
router.put('/batch-update/status', auth, async (req, res) => {
  const { taskIds, status } = req.body;
  
  // Validate input
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0 || !status) {
    return responseHandler.validationError(res, 'Please provide valid task ID array and status');
  }
  
  // Prevent batch setting status to Expired
  if (status === 'Expired') {
    return responseHandler.validationError(res, 'Not allowed to manually set tasks to Expired status');
  }
  
  try {
    // Validate status value
    const validStatuses = ['Pending', 'In Progress', 'Completed'];
    if (!validStatuses.includes(status)) {
      return responseHandler.validationError(res, 'Invalid status value');
    }
    
    // Find tasks that belong to current user
    const tasks = await Task.find({
      _id: { $in: taskIds },
      user: req.user.id
    });
    
    // If no tasks found, return error
    if (tasks.length === 0) {
      return responseHandler.notFound(res, 'No specified tasks found');
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
          const fixedDate = dateUtils.createFixedDate(new Date());
          
          await Task.updateOne(
            { _id: taskId },
            { $set: { status, start_time: fixedDate } }
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
    
    return responseHandler.success(res, { 
      updatedTasks: foundTaskIds,
      status
    }, 'Task status updated');
  } catch (err) {
    logger.error('Error batch updating task status', err);
    return responseHandler.error(res, 'Server error', 500, err);
  }
});

// Delete a task - DELETE /api/tasks/:id
router.delete('/:id', auth, verifyTaskOwnership, async (req, res) => {
  try {
    logger.debug('Processing delete request', { taskId: req.params.id });
    
    // Task is already available in req.task from verifyTaskOwnership middleware
    
    // Use findByIdAndDelete method
    const result = await Task.findByIdAndDelete(req.params.id);
    
    if (!result) {
      logger.warn('Delete operation did not delete any document');
      return responseHandler.notFound(res, 'Delete failed, task may have been already deleted');
    }
    
    logger.debug('Task deleted successfully', result);
    return responseHandler.success(res, null, 'Task deleted');
  } catch (err) {
    logger.error('Error deleting task', err);
    return responseHandler.error(res, 'Server error', 500, err);
  }
});

module.exports = router;
