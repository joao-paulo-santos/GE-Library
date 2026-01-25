/**
 * JSON report generation and validation
 * Single responsibility: JSON reports for CI/CD
 */

const { writeJson } = require('../filesystem');

class JsonReporter {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Generate validation report
     * @param {Object} results - Validation results
     * @param {Object} metadata - Metadata (tool type, etc.)
     * @returns {Object} - Report object
     */
    generateReport(results, metadata = {}) {
        const summary = this.generateSummary(results, metadata);
        const report = {
            validation_summary: summary,
            results: results,
            generated_at: new Date().toISOString()
        };

        this.logger.debug(`Generated report with ${Object.keys(results).length} test file results`);

        return report;
    }

    /**
     * Generate summary from results
     * @param {Object} results - Validation results
     * @param {Object} metadata - Metadata
     * @returns {Object} - Summary object
     */
    generateSummary(results, metadata) {
        const totalFilesTested = Object.keys(results).length;
        const successfulValidations = Object.values(results).filter(r => r.perfect_match).length;
        const successRate = totalFilesTested > 0 ? successfulValidations / totalFilesTested : 0;

        return {
            total_files_tested: totalFilesTested,
            successful_validations: successfulValidations,
            success_rate: successRate,
            tool_type: metadata.tool_type || 'unknown',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Save report to file
     * @param {Object} report - Report object
     * @param {string} reportPath - Output file path
     * @throws {Error} - If save fails
     */
    saveReport(report, reportPath) {
        this.logger.info(`Saving report to ${reportPath}`);

        try {
            writeJson(reportPath, report, 2);

            this.logger.info(`Report saved successfully`);
        } catch (error) {
            throw new Error(`Failed to save report: ${error.message}`);
        }
    }

    /**
     * Merge multiple reports
     * @param {Array<Object>} reports - Array of report objects
     * @returns {Object} - Merged report
     */
    mergeReports(reports) {
        this.logger.info(`Merging ${reports.length} reports`);

        const allResults = {};
        let totalFilesTested = 0;
        let successfulValidations = 0;

        for (const report of reports) {
            if (report.results) {
                Object.assign(allResults, report.results);
                totalFilesTested += Object.keys(report.results).length;

                if (report.validation_summary) {
                    successfulValidations += report.validation_summary.successful_validations || 0;
                }
            }
        }

        const summary = {
            total_files_tested: totalFilesTested,
            successful_validations: successfulValidations,
            success_rate: totalFilesTested > 0 ? successfulValidations / totalFilesTested : 0,
            tool_type: 'merged',
            timestamp: new Date().toISOString(),
            reports_merged: reports.length
        };

        return {
            validation_summary: summary,
            results: allResults,
            generated_at: new Date().toISOString()
        };
    }

    /**
     * Validate report structure
     * @param {Object} report - Report object
     * @returns {boolean} - True if valid
     */
    validateReport(report) {
        if (!report || typeof report !== 'object') {
            return false;
        }

        if (!report.validation_summary) {
            this.logger.warn('Report missing validation_summary');
            return false;
        }

        const requiredKeys = ['total_files_tested', 'successful_validations', 'success_rate', 'tool_type', 'timestamp'];
        for (const key of requiredKeys) {
            if (!(key in report.validation_summary)) {
                this.logger.warn(`Report missing required key: ${key}`);
                return false;
            }
        }

        return true;
    }
}

module.exports = JsonReporter;
