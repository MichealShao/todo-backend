/**
 * Global error handling middleware
 */
const logger = require('../utils/logger');

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(`Global error handler caught: ${req.method} ${req.path}`, err);
  
  // Get status code (default to 500)
  const statusCode = err.statusCode || 500;
  
  // Prepare the response
  const response = {
    error: {
      message: err.message || 'Internal Server Error'
    }
  };
  
  // Add more details in development mode
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
    
    // Add validation errors if available
    if (err.errors) {
      response.error.details = err.errors;
    }
  }
  
  // Send response
  res.status(statusCode).json(response);
};

module.exports = errorHandler; 