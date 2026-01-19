/**
 * Console output formatting
 * Single responsibility: Console output with symbols
 */

class ConsoleReporter {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Print validation summary
     * @param {Object} summary - Summary object
     */
    printValidationSummary(summary) {
        const { success_rate, total_files_tested, successful_validations } = summary;

        if (success_rate === 1) {
            this.printSuccess(`Validation complete: ${successful_validations}/${total_files_tested} tests passed`);
        } else {
            this.printError(`Validation failed: ${successful_validations}/${total_files_tested} tests passed (${(success_rate * 100).toFixed(1)}%)`);
        }
    }

    /**
     * Print validation details
     * @param {Object} results - Results object
     */
    printValidationDetails(results) {
        if (!results) {
            return;
        }

        for (const [key, result] of Object.entries(results)) {
            const status = result.perfect_match ? '✓' : '✗';
            const statusText = result.perfect_match ? 'PASS' : 'FAIL';

            if (result.perfect_match) {
                this.printSuccess(`${status} ${key}: ${statusText}`);
            } else {
                this.printError(`${status} ${key}: ${statusText} - ${result.error || result.reason || 'Unknown error'}`);
            }

            if (result.tool_type) {
                this.logger.debug(`Tool type: ${result.tool_type}`);
            }
            if (result.strategy) {
                this.logger.debug(`Strategy: ${result.strategy}`);
            }
        }
    }

    /**
     * Print comparison statistics
     * @param {Object} stats - Statistics object
     */
    printComparisonStats(stats) {
        if (!stats) {
            return;
        }

        const type = stats.strategy || 'unknown';

        this.printInfo(`Comparison type: ${type}`);

        if (stats.file_count_match !== undefined) {
            const status = stats.file_count_match ? '✓' : '✗';
            this.printInfo(`${status} File count: ${stats.file_count_match ? 'MATCH' : 'MISMATCH'}`);
        }

        if (stats.total_size_match !== undefined) {
            const status = stats.total_size_match ? '✓' : '✗';
            this.printInfo(`${status} Total size: ${stats.total_size_match ? 'MATCH' : 'MISMATCH'}`);
        }

        if (stats.size_difference_percent !== undefined) {
            this.printInfo(`Size difference: ${stats.size_difference_percent.toFixed(2)}%`);
        }

        if (type === 'full') {
            if (stats.manifest_hash_match !== undefined) {
                const status = stats.manifest_hash_match ? '✓' : '✗';
                this.printInfo(`${status} Manifest hash: ${stats.manifest_hash_match ? 'MATCH' : 'MISMATCH'}`);
            }

            if (stats.missing_files_count > 0) {
                this.printWarning(`${stats.missing_files_count} missing files`);
            }

            if (stats.extra_files_count > 0) {
                this.printWarning(`${stats.extra_files_count} extra files`);
            }

            if (stats.hash_mismatches_count > 0) {
                this.printWarning(`${stats.hash_mismatches_count} hash mismatches`);
            }
        } else if (type === 'sampling') {
            if (stats.sample_hash_match !== undefined) {
                const status = stats.sample_hash_match ? '✓' : '✗';
                this.printInfo(`${status} Sample hash: ${stats.sample_hash_match ? 'MATCH' : 'MISMATCH'}`);
            }

            if (stats.sample_mismatches_count > 0) {
                this.printWarning(`${stats.sample_mismatches_count} sample mismatches`);
            }
        }

        if (stats.perfect_match !== undefined && stats.perfect_match) {
            this.printSuccess('Perfect match: All checks passed');
        }
    }

    /**
     * Print success message with checkmark
     * @param {string} message - Message to print
     */
    printSuccess(message) {
        console.log(`✓ ${message}`);
        this.logger.info(message);
    }

    /**
     * Print error message with X
     * @param {string} message - Message to print
     */
    printError(message) {
        console.error(`✗ ${message}`);
        this.logger.error(message);
    }

    /**
     * Print warning message
     * @param {string} message - Message to print
     */
    printWarning(message) {
        console.warn(`⚠ ${message}`);
        this.logger.warn(message);
    }

    /**
     * Print info message
     * @param {string} message - Message to print
     */
    printInfo(message) {
        console.log(`ℹ ${message}`);
        this.logger.info(message);
    }
}

module.exports = ConsoleReporter;
