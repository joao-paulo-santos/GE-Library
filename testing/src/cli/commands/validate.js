/**
 * Validate command implementation
 * Single responsibility: Validate IPF extraction outputs
 */

const path = require('path');
const ExtractValidator = require('../../validation/extract-validator');
const { fileExists } = require('../../filesystem');
const JsonReporter = require('../../reporting/json-reporter');
const Logger = require('../../logger');
const config = require('../../config');

async function validateSingle(options) {
    const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
    const jsonReporter = new JsonReporter(logger);

    if (!options.output || !options.testKey) {
        logger.error('Missing required options: --output and --test-key');
        return 1;
    }

    if (!fileExists(options.output)) {
        logger.error(`Output not found: ${options.output}`);
        return 1;
    }

    const referencePath = options.reference || config.TEST_HASHES_DIR + '/tools/extraction/original_hashes.json';

    if (!fileExists(referencePath)) {
        logger.error(`Reference hashes not found: ${referencePath}`);
        return 1;
    }

    const validator = new ExtractValidator(referencePath, logger);
    const result = await validator.validate(options.output, options.testKey);

    if (result.perfect_match) {
        logger.success(`✓ ${options.testKey}: PASS`);
    } else {
        logger.error(`✗ ${options.testKey}: FAIL - ${result.error || result.reason || 'Unknown error'}`);
    }

    if (!options.quiet) {
        const summary = {
            total_files_tested: 1,
            successful_validations: result.perfect_match ? 1 : 0,
            success_rate: result.perfect_match ? 1 : 0
        };

        if (summary.success_rate === 1) {
            logger.success(`Validation complete: ${summary.successful_validations}/${summary.total_files_tested} tests passed`);
        } else {
            logger.error(`Validation failed: ${summary.successful_validations}/${summary.total_files_tested} tests passed (${(summary.success_rate * 100).toFixed(1)}%)`);
        }
    }

    if (options.reportJson) {
        const report = jsonReporter.generateReport({ [options.testKey]: result }, {
            tool_type: 'extraction'
        });

        jsonReporter.saveReport(report, options.reportJson);
        logger.info(`Report saved to: ${options.reportJson}`);
    }

    return result.perfect_match ? 0 : 1;
}

async function validateAll(options) {
    const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
    const jsonReporter = new JsonReporter(logger);
    const referencePath = config.TEST_HASHES_DIR + '/tools/extraction/original_hashes.json';
    const validator = new ExtractValidator(referencePath, logger);

    logger.info('=== Granado Espada IPF Extraction Validation ===');
    logger.info(`Tool type: extraction`);
    logger.info(`Reference hashes: Available`);

    const results = {};
    let successfulCount = 0;
    let totalCount = 0;

    for (const [fileKey, fileConfig] of Object.entries(config.TEST_FILES)) {
        const result = await validator.validate(fileConfig.output, fileKey);
        results[fileKey] = result;

        if (result.status === 'validation_complete') {
            totalCount++;

            if (result.perfect_match) {
                successfulCount++;
                if (options.verbose) {
                    logger.success(`✓ ${fileKey}: PASS`);
                }
            } else {
                if (options.verbose) {
                    logger.error(`✗ ${fileKey}: FAIL - ${result.error || result.reason || 'Unknown error'}`);
                }
            }
        }
    }

    const summary = {
        total_files_tested: totalCount,
        successful_validations: successfulCount,
        success_rate: totalCount > 0 ? successfulCount / totalCount : 0
    };

    if (summary.success_rate === 1) {
        logger.success(`Validation complete: ${summary.successful_validations}/${summary.total_files_tested} tests passed`);
    } else {
        logger.error(`Validation failed: ${summary.successful_validations}/${summary.total_files_tested} tests passed (${(summary.success_rate * 100).toFixed(1)}%)`);
    }

    const report = jsonReporter.generateReport(results, {
        tool_type: 'extraction'
    });

    if (options.reportJson) {
        jsonReporter.saveReport(report, options.reportJson);
        logger.info(`Report saved to: ${options.reportJson}`);
    }

    return summary.success_rate === 1 ? 0 : 1;
}

module.exports = {
    async execute(options) {
        if (options.verbose) {
            const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
            logger.setLevel('debug');
        }

        if (options.testKey && options.output) {
            return await validateSingle(options);
        } else {
            return await validateAll(options);
        }
    },

    validateSingle,
    validateAll,

    showHelp() {
        return `
validate - Validate IPF extraction output

Usage:
    node validate.js [options]

Description:
    Validate IPF extraction outputs against reference hashes.

Options:
    --verbose, -v       Enable detailed output
    --quiet, -q         Suppress console output
    --report-json <path>  Save report to JSON file
    --help, -h          Show this help message

Examples:
    node validate.js --test-key small --output reference_our/small_our
    node validate.js --verbose --report-json report.json
        `;
    }
};
