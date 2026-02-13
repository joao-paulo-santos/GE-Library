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
        this.levels = { debug: 0, verbose: 1, info: 2, warn: 3, error: 4 };
    }

    log(message, level = 'info', symbol = null) {
        if (this.levels[level] < this.levels[this.level]) {
            return;
        }

        const timestamp = new Date().toISOString();

        if (this.sink === 'console' || this.sink === 'both') {
            if (symbol) {
                console.log(`${symbol} ${message}`);
            } else {
                console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
            }
        }

        if (this.sink === 'file' || this.sink === 'both') {
            const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
            try {
                fs.appendFileSync(this.logFile, formatted + '\n', 'utf8');
            } catch (error) {
                console.error(`Failed to write to log file: ${error.message}`);
            }
        }
    }

    info(message) {
        this.log(message, 'info', 'ℹ');
    }

    warn(message) {
        this.log(message, 'warn', '⚠');
    }

    error(message) {
        this.log(message, 'error', '✗');
    }

    debug(message) {
        this.log(message, 'debug');
    }

    verbose(message) {
        this.log(message, 'verbose', '  ');
    }

    success(message) {
        this.log(message, 'info', '✓');
    }

    plain(message) {
        if (this.levels['info'] < this.levels[this.level]) {
            return;
        }

        if (this.sink === 'console' || this.sink === 'both') {
            console.log(message);
        }

        if (this.sink === 'file' || this.sink === 'both') {
            try {
                fs.appendFileSync(this.logFile, message + '\n', 'utf8');
            } catch (error) {
                console.error(`Failed to write to log file: ${error.message}`);
            }
        }
    }

    setLevel(level) {
        if (!(level in this.levels)) {
            throw new Error(`Invalid log level: ${level}`);
        }
        this.level = level;
    }

    setSink(sink) {
        const validSinks = ['console', 'file', 'both'];
        if (!validSinks.includes(sink)) {
            throw new Error(`Invalid sink: ${sink}`);
        }
        this.sink = sink;
    }
}

module.exports = Logger;
