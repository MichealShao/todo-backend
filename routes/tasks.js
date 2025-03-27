const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const mongoose = require('mongoose');

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
      // 获取今天的日期（去除时间部分）
      const now = new Date();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Find all tasks with deadline passed but status not yet set to Expired
      const tasksToUpdate = await Task.find({
        user: req.user.id,
        deadline: { $lt: todayDate }, // 使用今天的日期（不含时间）作为比较
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
    
    // 修复时区问题 - 处理deadline以保留用户选择的日期
    let deadlineDate = new Date(deadline);
    // 使用ISO字符串创建新日期，固定为中午12:00，避免时区问题
    const deadlineYear = deadlineDate.getFullYear();
    const deadlineMonth = deadlineDate.getMonth() + 1; // 月份需要+1才是真实月份(1-12)
    const deadlineDay = deadlineDate.getDate();
    const deadlineDateStr = `${deadlineYear}-${deadlineMonth.toString().padStart(2, '0')}-${deadlineDay.toString().padStart(2, '0')}T12:00:00.000Z`;
    deadlineDate = new Date(deadlineDateStr);
    
    // 获取今天的日期（去除时间部分）
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 获取截止日期（去除时间部分）
    const deadlineDateOnly = new Date(
      deadlineDate.getFullYear(), 
      deadlineDate.getMonth(), 
      deadlineDate.getDate()
    );
    
    // If deadline is strictly before today, automatically set to Expired
    if (deadlineDateOnly < todayDate) {
      initialStatus = 'Expired';
    } 
    // Prevent users from manually setting status to Expired
    else if (initialStatus === 'Expired') {
      initialStatus = 'Pending';
    }
    
    // 修复start_time时区问题，采用与deadline完全相同的处理方式
    let fixedStartTime = null;
    if (start_time && initialStatus !== 'Pending') {
      // 处理时区问题，确保日期不变
      let startTimeDate = new Date(start_time);
      
      // 修复时区问题 - 使用用户选择的确切日期
      const startYear = startTimeDate.getFullYear();
      const startMonth = startTimeDate.getMonth() + 1; // 月份需要+1才是真实月份(1-12)
      const startDay = startTimeDate.getDate();
      
      // 使用ISO字符串创建新日期，与deadline处理方式完全一致
      const startDateStr = `${startYear}-${startMonth.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}T12:00:00.000Z`;
      fixedStartTime = new Date(startDateStr);
      
      console.log('Fixed start_time:', fixedStartTime);
    } else if (initialStatus === 'In Progress' && !start_time) {
      // 如果状态是In Progress但没有提供start_time，使用当前时间
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1; // 月份需要+1才是真实月份(1-12)
      const day = now.getDate();
      
      // 使用ISO字符串创建新日期，与deadline处理方式完全一致
      const todayDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T12:00:00.000Z`;
      fixedStartTime = new Date(todayDateStr);
    }
    
    const newTask = new Task({
      priority,
      deadline: deadlineDate, // 使用修正后的deadline日期
      hours,
      details,
      status: initialStatus,
      start_time: fixedStartTime,
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
    console.log('Update task request body:', req.body); // Log complete request body for debugging
    
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
    
    // 修复时区问题 - 处理deadline
    if (deadline) {
      // 使用ISO字符串创建新日期，固定为中午12:00，避免时区问题
      let deadlineDate = new Date(deadline);
      const deadlineYear = deadlineDate.getFullYear();
      const deadlineMonth = deadlineDate.getMonth() + 1; // 月份需要+1才是真实月份(1-12)
      const deadlineDay = deadlineDate.getDate();
      const deadlineDateStr = `${deadlineYear}-${deadlineMonth.toString().padStart(2, '0')}-${deadlineDay.toString().padStart(2, '0')}T12:00:00.000Z`;
      taskFields.deadline = new Date(deadlineDateStr);
    }
    
    // 修复 start_time 的处理逻辑，采用与deadline完全相同的处理方式
    // 检查 start_time 是否直接作为参数提供，与状态无关
    if (start_time !== undefined) {
      console.log('Directly processing start_time update:', start_time);
      try {
        if (status === 'Pending' || task.status === 'Pending' && status === undefined) {
          // 如果当前状态是Pending或要更新为Pending，start_time应为null
          taskFields.start_time = null;
          console.log('Setting start_time to null for Pending status');
        } else if (start_time) {
          // 处理 start_time 时区问题，与deadline完全一致
          let startTimeDate = new Date(start_time);
          
          // 修复时区问题 - 使用用户选择的确切日期，而不受时区影响
          const startYear = startTimeDate.getFullYear();
          const startMonth = startTimeDate.getMonth() + 1; // 月份需要+1才是真实月份(1-12)
          const startDay = startTimeDate.getDate();
          
          // 使用ISO字符串创建新日期，与deadline处理方式完全一致
          const startDateStr = `${startYear}-${startMonth.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}T12:00:00.000Z`;
          taskFields.start_time = new Date(startDateStr);
          
          console.log('New start_time set to:', taskFields.start_time);
        } else {
          // 如果明确设置为null且状态不是Pending
          console.log('Warning: Setting start_time to null for non-Pending task');
          taskFields.start_time = null;
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
          // 只有在未明确提供 start_time 时，才通过状态变更自动设置 start_time
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
      // 获取今天的日期（去除时间部分）
      const now = new Date();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // 获取新截止日期（去除时间部分）
      const deadlineDate = new Date(taskFields.deadline);
      const deadlineDateOnly = new Date(
        deadlineDate.getFullYear(), 
        deadlineDate.getMonth(), 
        deadlineDate.getDate()
      );
      
      if (deadlineDateOnly < todayDate) {
        // If new deadline is strictly before today, automatically set to Expired
        taskFields.status = 'Expired';
        console.log('New deadline is in the past, automatically setting status to Expired');
      }
    } else {
      // If deadline isn't updated, check if existing deadline is expired
      // 获取今天的日期（去除时间部分）
      const now = new Date();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // 获取现有截止日期（去除时间部分）
      const existingDeadline = new Date(task.deadline);
      const existingDeadlineDateOnly = new Date(
        existingDeadline.getFullYear(), 
        existingDeadline.getMonth(), 
        existingDeadline.getDate()
      );
      
      if (existingDeadlineDateOnly < todayDate && task.status !== 'Expired') {
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
      // Individual update to handle start_time correctly
      for (const taskId of foundTaskIds) {
        const task = await Task.findById(taskId);
        // Only set start_time if changing from a status that's not In Progress
        if (task.status !== 'In Progress') {
          // 修复时区问题 - 使用ISO字符串创建新日期，与deadline处理方式完全一致
          const currentDate = new Date();
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth() + 1; // 月份需要+1才是真实月份(1-12)
          const day = currentDate.getDate();
          
          // 使用ISO字符串创建新日期，与deadline处理方式完全一致
          const todayDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T12:00:00.000Z`;
          const fixedDate = new Date(todayDateStr);
          
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
