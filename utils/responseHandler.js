/**
 * Response handler utility for consistent API responses
 */

/**
 * Send a success response
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Express response
 */
const success = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Send an error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {any} details - Error details (only included in development)
 * @returns {Object} Express response
 */
const error = (res, message = 'Error occurred', statusCode = 400, details = null) => {
  const response = {
    success: false,
    message
  };
  
  // Include error details in development mode
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Send a not found response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @returns {Object} Express response
 */
const notFound = (res, message = 'Resource not found') => {
  return error(res, message, 404);
};

/**
 * Send an unauthorized response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @returns {Object} Express response
 */
const unauthorized = (res, message = 'Unauthorized access') => {
  return error(res, message, 401);
};

/**
 * Send a validation error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object} errors - Validation errors
 * @returns {Object} Express response
 */
const validationError = (res, message = 'Validation failed', errors = {}) => {
  return error(res, message, 400, { errors });
};

module.exports = {
  success,
  error,
  notFound,
  unauthorized,
  validationError
}; 