/**
 * Validate command implementation
 * Single responsibility: Validate IPF extraction outputs
 */

const path = require('path');
const ExtractValidator = require('../../validation/extract-validator');
const { fileExists } = require('../../filesystem');
const ConsoleReporter = require('../../reporting/console-reporter');
const JsonReporter = require('../../reporting/json-reporter');
const Logger = require('../../logger');
const config = require('../../config');

async function validateSingle(options) {
    const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
    const consoleReporter = new ConsoleReporter(logger);
    const jsonReporter = new JsonReporter(logger);

    if (!options.output || !options.testKey) {
        logger.error('Missing required options: --output and --test-key');
        consoleReporter.printError('Missing required options: --output and --test-key');
        return 1;
    }

    if (!fileExists(options.output)) {
        logger.error(`Output not found: ${options.output}`);
        consoleReporter.printError(`Output not found: ${options.output}`);
        return 1;
    }

    const referencePath = options.reference || config.EXTRACTION_ORIGINAL_HASHES_PATH;

    if (!fileExists(referencePath)) {
        logger.error(`Reference hashes not found: ${referencePath}`);
        consoleReporter.printError(`Reference hashes not found: ${referencePath}`);
        return 1;
    }

    const validator = new ExtractValidator(referencePath, logger);
    const result = await validator.validate(options.output, options.testKey);

    consoleReporter.printValidationDetails({ [options.testKey]: result });

    if (!options.quiet) {
        const summary = {
            total_files_tested: 1,
            successful_validations: result.perfect_match ? 1 : 0,
            success_rate: result.perfect_match ? 1 : 0
        };

        consoleReporter.printValidationSummary(summary);
    }

    const { getExitCode } = require('../command-utils');
    return getExitCode(result);
}

async function validateAll(options) {
    const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
    const consoleReporter = new ConsoleReporter(logger);
    const jsonReporter = new JsonReporter(logger);
    const referencePath = config.EXTRACTION_ORIGINAL_HASHES_PATH;
    const validator = new ExtractValidator(referencePath, logger);

    consoleReporter.printInfo('=== Granado Espada IPF Extraction Validation ===');
    consoleReporter.printInfo(`Tool type: extraction`);
    consoleReporter.printInfo(`Reference hashes: Available`);

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
                    consoleReporter.printSuccess(`${fileKey}: Perfect match`);
                }
            } else {
                if (options.verbose) {
                    consoleReporter.printError(`${fileKey}: Failed - ${result.error || result.reason || 'Unknown error'}`);
                }
            }
        }
    }

    const summary = {
        total_files_tested: totalCount,
        successful_validations: successfulCount,
        success_rate: totalCount > 0 ? successfulCount / totalCount : 0
    };

    consoleReporter.printValidationSummary(summary);

    const report = jsonReporter.generateReport(results, {
        tool_type: 'extraction'
    });

    if (options.reportJson) {
        jsonReporter.saveReport(report, options.reportJson);
        logger.info(`Report saved to: ${options.reportJson}`);
    }

    const { getExitCode } = require('../command-utils');
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
    --help, -h          Show this help message

Examples:
    node validate.js --test-key small --output reference_our/small_our
    node validate.js --verbose
`;
    }
};
