/**
 * Logger utility for consistent logging across the application
 */

/**
 * Log levels:
 * - debug: Only shown in development
 * - info: Shown in development and when LOG_LEVEL is set to info
 * - warn: Always shown
 * - error: Always shown
 */

// Format date for log prefix
const getLogTimeStamp = () => {
  return new Date().toISOString();
};

/**
 * Log debug message (only in development)
 * @param {string} message - Message to log
 * @param {any} data - Optional data to log
 */
const debug = (message, data) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${getLogTimeStamp()}][DEBUG] ${message}`, data || '');
  }
};

/**
 * Log info message
 * @param {string} message - Message to log
 * @param {any} data - Optional data to log
 */
const info = (message, data) => {
  if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'info') {
    console.log(`[${getLogTimeStamp()}][INFO] ${message}`, data || '');
  }
};

/**
 * Log warning message
 * @param {string} message - Message to log
 * @param {any} data - Optional data to log
 */
const warn = (message, data) => {
  console.warn(`[${getLogTimeStamp()}][WARN] ${message}`, data || '');
};

/**
 * Log error message
 * @param {string} message - Message to log
 * @param {any} error - Optional error to log
 */
const error = (message, error) => {
  console.error(`[${getLogTimeStamp()}][ERROR] ${message}`);
  
  if (error) {
    if (error instanceof Error) {
      console.error(`Error details: ${error.message}`);
      if (process.env.NODE_ENV === 'development') {
        console.error(error.stack);
      }
    } else {
      console.error('Additional error data:', error);
    }
  }
};

module.exports = {
  debug,
  info,
  warn,
  error
}; 