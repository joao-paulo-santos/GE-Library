/**
 * Configurable logging with multiple sinks
 * Single responsibility: Log messages to console and/or file
 */

const fs = require('fs');
const path = require('path');

class Logger {
    constructor(level = 'info', sink = 'console', logFile = 'validation.log') {
        this.level = level;
        this.sink = sink;
        this.logFile = logFile;
        this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
    }

    /**
     * Core logging method
     * @param {string} message - Message to log
     * @param {string} level - Log level (debug, info, warn, error)
     */
    log(message, level = 'info') {
        if (this.levels[level] < this.levels[this.level]) {
            return;
        }

        const timestamp = new Date().toISOString();
        const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

        if (this.sink === 'console' || this.sink === 'both') {
            console.log(formatted);
        }

        if (this.sink === 'file' || this.sink === 'both') {
            try {
                fs.appendFileSync(this.logFile, formatted + '\n', 'utf8');
            } catch (error) {
                console.error(`Failed to write to log file: ${error.message}`);
            }
        }
    }

    info(message) {
        this.log(message, 'info');
    }

    warn(message) {
        this.log(message, 'warn');
    }

    error(message) {
        this.log(message, 'error');
    }

    debug(message) {
        this.log(message, 'debug');
    }

    /**
     * Change log level
     * @param {string} level - New log level
     */
    setLevel(level) {
        if (!(level in this.levels)) {
            throw new Error(`Invalid log level: ${level}`);
        }
        this.level = level;
    }

    /**
     * Change output sink
     * @param {string} sink - New sink (console, file, both)
     */
    setSink(sink) {
        const validSinks = ['console', 'file', 'both'];
        if (!validSinks.includes(sink)) {
            throw new Error(`Invalid sink: ${sink}`);
        }
        this.sink = sink;
    }
}

module.exports = Logger;
