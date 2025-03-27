/**
 * Middleware to verify task ownership
 */
const Task = require('../models/Task');
const responseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

/**
 * Middleware to verify that a task belongs to the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const verifyTaskOwnership = async (req, res, next) => {
  try {
    const taskId = req.params.id;
    
    if (!taskId) {
      return responseHandler.validationError(res, 'Task ID is required');
    }
    
    logger.debug(`Verifying ownership of task: ${taskId}`);
    
    // Find the task
    const task = await Task.findById(taskId);
    
    // Check if task exists
    if (!task) {
      logger.info(`Task not found: ${taskId}`);
      return responseHandler.notFound(res, 'Task not found');
    }
    
    // Check if the task belongs to the current user
    if (task.user.toString() !== req.user.id) {
      logger.warn(`Unauthorized access attempt to task ${taskId} by user ${req.user.id}`);
      return responseHandler.unauthorized(res, 'Not authorized to access this task');
    }
    
    // Add task to request object for later use
    req.task = task;
    next();
  } catch (err) {
    logger.error('Error verifying task ownership', err);
    
    if (err.kind === 'ObjectId') {
      return responseHandler.notFound(res, 'Invalid task ID format');
    }
    
    return responseHandler.error(res, 'Server error', 500, err);
  }
};

module.exports = verifyTaskOwnership; 