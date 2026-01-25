/**
 * Coordinate hashing with strategy pattern
 * Single responsibility: Route hashing to appropriate strategy
 */

const config = require('../config');

class HashCalculator {
    constructor(strategy) {
        this.validateStrategy(strategy);
        this.strategy = strategy;
    }

    /**
     * Calculate directory hash using configured strategy
     * @param {string} dirPath - Directory path
     * @returns {Promise<Object>} - Hash information
     */
    async calculate(dirPath) {
        return await this.strategy.calculateHash(dirPath);
    }

    /**
     * Validate strategy has required methods
     * @param {Object} strategy - Strategy instance
     * @throws {Error} - If strategy is invalid
     */
    validateStrategy(strategy) {
        const requiredMethods = ['calculateHash'];
        const requiredProperties = ['name'];
        const missingMethods = [];

        for (const method of requiredMethods) {
            if (typeof strategy[method] !== 'function') {
                missingMethods.push(method);
            }
        }

        for (const prop of requiredProperties) {
            if (typeof strategy[prop] !== 'string') {
                missingMethods.push(prop);
            }
        }

        if (missingMethods.length > 0) {
            throw new Error(
                `Invalid strategy: missing methods ${missingMethods.join(', ')}`
            );
        }
    }

    /**
     * Get strategy name
     * @returns {string} - Strategy name
     */
    getStrategyName() {
        return this.strategy.name || 'unknown';
    }
}

/**
 * Create appropriate strategy based on file count
 * @param {number} fileCount - Number of files in directory
 * @param {Object} config - Configuration object
 * @returns {Object} - Strategy instance
 */
function createStrategy(fileCount, config) {
    const SamplingStrategy = require('./strategies/sampling-strategy');
    const FullStrategy = require('./strategies/full-strategy');

    if (fileCount <= config.HASH_STRATEGY_THRESHOLD) {
        return new FullStrategy();
    }

    return new SamplingStrategy(config.SAMPLING_CONFIG);
}

/**
 * Calculate directory hash with automatic strategy selection
 * @param {string} dirPath - Directory path
 * @returns {Promise<Object>} - Hash information
 */
async function calculateDirectoryHash(dirPath) {
    const { analyzeDirectory } = require('../analysis/directory-analyzer');

    const analysis = await analyzeDirectory(dirPath);
    const strategy = createStrategy(analysis.file_count, config);
    const calculator = new HashCalculator(strategy);

    return await calculator.calculate(dirPath);
}

module.exports = {
    HashCalculator,
    createStrategy,
    calculateDirectoryHash
};
