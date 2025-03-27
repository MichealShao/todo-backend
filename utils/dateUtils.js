/**
 * Date utility functions for consistent date handling across the application
 */

/**
 * Creates a fixed date at noon (12:00 UTC) to avoid timezone issues
 * @param {Date|string} date - Date object or date string to fix
 * @returns {Date} - New date object fixed at 12:00 UTC
 */
const createFixedDate = (date) => {
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // Months are 0-based in JavaScript
  const day = dateObj.getDate();
  
  // Create ISO string with time fixed at noon UTC
  const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T12:00:00.000Z`;
  return new Date(dateStr);
};

/**
 * Gets date part only (removes time component)
 * @param {Date} date - Date to process
 * @returns {Date} - Date with time set to 00:00:00
 */
const getDateOnly = (date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

/**
 * Gets today's date with time component removed
 * @returns {Date} - Today's date at 00:00:00
 */
const getTodayDate = () => {
  const now = new Date();
  return getDateOnly(now);
};

/**
 * Compares two dates (date part only)
 * @param {Date} date1 - First date to compare
 * @param {Date} date2 - Second date to compare
 * @returns {number} - Negative if date1 < date2, positive if date1 > date2, 0 if equal
 */
const compareDates = (date1, date2) => {
  const d1 = getDateOnly(new Date(date1));
  const d2 = getDateOnly(new Date(date2));
  return d1 - d2;
};

/**
 * Checks if a date is before today (strictly)
 * @param {Date} date - Date to check
 * @returns {boolean} - True if date is before today, false otherwise
 */
const isBeforeToday = (date) => {
  const dateOnly = getDateOnly(new Date(date));
  const todayDate = getTodayDate();
  return dateOnly < todayDate;
};

module.exports = {
  createFixedDate,
  getDateOnly,
  getTodayDate,
  compareDates,
  isBeforeToday
}; 