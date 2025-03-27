/**
 * Task utility functions for task-related operations
 */
const Task = require('../models/Task');
const dateUtils = require('./dateUtils');
const logger = require('./logger');

/**
 * Check if a task is expired
 * @param {Object} task - Task object to check
 * @returns {boolean} - True if task is expired, false otherwise
 */
const isTaskExpired = (task) => {
  // Expired tasks remain expired
  if (task.status === 'Expired') {
    return false;
  }
  
  // Get task deadline (date part only)
  const deadline = new Date(task.deadline);
  const deadlineDate = dateUtils.getDateOnly(deadline);
  
  // Get today's date
  const todayDate = dateUtils.getTodayDate();
  
  // Only consider expired if deadline is strictly before today
  return deadlineDate < todayDate;
};

/**
 * Update all expired tasks for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of tasks updated
 */
const updateExpiredTasksForUser = async (userId) => {
  try {
    // Get today's date without time component
    const todayDate = dateUtils.getTodayDate();
    
    // Find all tasks with deadline passed but status not yet set to Expired
    const tasksToUpdate = await Task.find({
      user: userId,
      deadline: { $lt: todayDate },
      status: { $ne: 'Expired' }
    });
    
    if (tasksToUpdate.length > 0) {
      logger.info(`Found ${tasksToUpdate.length} expired tasks for user ${userId}, updating status`);
      
      // Batch update these tasks to Expired status
      const result = await Task.updateMany(
        { 
          _id: { $in: tasksToUpdate.map(t => t._id) },
          user: userId
        },
        { $set: { status: 'Expired' } }
      );
      
      return result.nModified || result.modifiedCount || 0;
    }
    
    return 0;
  } catch (err) {
    logger.error('Error updating expired tasks', err);
    return 0;
  }
};

/**
 * Process start time based on status
 * @param {string} status - Task status
 * @param {Date|null} currentStartTime - Current start time
 * @param {string|null} oldStatus - Previous status
 * @returns {Date|null} - Processed start time
 */
const processStartTime = (status, currentStartTime = null, oldStatus = null) => {
  // For Pending tasks, start_time should always be null
  if (status === 'Pending') {
    return null;
  }
  
  // For In Progress tasks
  if (status === 'In Progress') {
    // If already has a start_time, validate and return it
    if (currentStartTime) {
      // Ensure start_time is not before today
      const startDate = new Date(currentStartTime);
      const todayDate = dateUtils.getTodayDate();
      const startDateOnly = dateUtils.getDateOnly(startDate);
      
      // If start date is before today, that's invalid
      if (startDateOnly < todayDate) {
        throw new Error('Start time cannot be earlier than today');
      }
      
      // Fix the time to noon UTC
      return dateUtils.createFixedDate(startDate);
    }
    
    // If changing to In Progress from another status, set to today
    if (oldStatus !== 'In Progress') {
      const now = new Date();
      return dateUtils.createFixedDate(now);
    }
  }
  
  // For direct updates of start_time
  if (currentStartTime !== undefined && currentStartTime !== null && status !== 'Pending') {
    return dateUtils.createFixedDate(currentStartTime);
  }
  
  // For other cases, keep existing start_time
  return currentStartTime;
};

/**
 * Validate a task update
 * @param {Object} task - Current task object
 * @param {Object} updates - Update fields
 * @returns {Object} - Validated update fields
 */
const validateTaskUpdate = (task, updates) => {
  const validatedUpdates = { ...updates };
  
  // Process deadline if provided
  if (updates.deadline) {
    validatedUpdates.deadline = dateUtils.createFixedDate(updates.deadline);
    
    // Check if new deadline is expired
    if (dateUtils.isBeforeToday(validatedUpdates.deadline)) {
      validatedUpdates.status = 'Expired';
    }
  } else if (task && dateUtils.isBeforeToday(task.deadline) && task.status !== 'Expired') {
    // If not updating deadline but existing deadline is expired
    validatedUpdates.status = 'Expired';
  }
  
  // Process status update
  if (updates.status !== undefined && updates.status !== 'Expired') {
    validatedUpdates.status = updates.status;
    
    // Process start_time based on status if not explicitly provided
    if (updates.start_time === undefined) {
      try {
        validatedUpdates.start_time = processStartTime(
          updates.status, 
          task ? task.start_time : null,
          task ? task.status : null
        );
      } catch (error) {
        throw error;
      }
    }
  }
  
  // Process explicit start_time update
  if (updates.start_time !== undefined) {
    const newStatus = validatedUpdates.status || (task ? task.status : 'Pending');
    
    if (newStatus === 'Pending') {
      validatedUpdates.start_time = null;
    } else if (updates.start_time) {
      validatedUpdates.start_time = dateUtils.createFixedDate(updates.start_time);
    }
  }
  
  return validatedUpdates;
};

module.exports = {
  isTaskExpired,
  updateExpiredTasksForUser,
  processStartTime,
  validateTaskUpdate
}; 