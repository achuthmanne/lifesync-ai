/**
 * Time Simulation Service
 * Manages virtual time for testing and demonstration purposes.
 */

let timeOffsetDays = 0;

/**
 * Get the current virtual time
 * @returns {Date}
 */
const getCurrentTime = () => {
    const now = new Date();
    if (process.env.ENABLE_TIME_SIMULATION === 'true' && timeOffsetDays !== 0) {
        return new Date(now.getTime() + (timeOffsetDays * 24 * 60 * 60 * 1000));
    }
    return now;
};

/**
 * Set the time offset in days
 * @param {number} days 
 */
const setOffset = (days) => {
    if (process.env.ENABLE_TIME_SIMULATION !== 'true') return;
    timeOffsetDays = days;
};

/**
 * Add days to the current offset
 * @param {number} days 
 */
const addDays = (days) => {
    if (process.env.ENABLE_TIME_SIMULATION !== 'true') return;
    timeOffsetDays += days;
};

const getOffset = () => timeOffsetDays;

module.exports = {
    getCurrentTime,
    setOffset,
    addDays,
    getOffset
};
