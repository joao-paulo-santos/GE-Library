/**
 * Command utilities
 * Single responsibility: Common command helper functions
 */

/**
 * Get exit code from validation result
 * @param {Object} result - Validation result
 * @returns {number} - Exit code (0 = success, 1 = failure)
 */
function getExitCode(result) {
    if (result.perfect_match) {
        return 0;
    }
    return 1;
}

/**
 * Format error message for display
 * @param {Error} error - Error object
 * @param {string} command - Command name
 * @returns {string} - Formatted error message
 */
function formatError(error, command) {
    const message = error.message || 'Unknown error';
    return `${command} failed: ${message}`;
}

module.exports = {
    getExitCode,
    formatError
};
