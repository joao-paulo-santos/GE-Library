#!/usr/bin/env node

/**
 * Compare command implementation
 * Single responsibility: Compare pre-existing outputs with reference hashes
 */

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

async function validateMultiple(options) {
    const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
    const jsonReporter = new JsonReporter(logger);

    if (!options.outputMap) {
        logger.error('Missing required option: --output-map');
        return 1;
    }

    let outputMap;
    try {
        outputMap = JSON.parse(options.outputMap);
    } catch (error) {
        logger.error(`Invalid --output-map JSON: ${error.message}`);
        return 1;
    }

    const referencePath = options.reference || config.TEST_HASHES_DIR + '/tools/extraction/original_hashes.json';

    if (!fileExists(referencePath)) {
        logger.error(`Reference hashes not found: ${referencePath}`);
        return 1;
    }

    const validator = new ExtractValidator(referencePath, logger);
    const results = {};
    const keys = Object.keys(outputMap);

    for (const [testKey, outputPath] of Object.entries(outputMap)) {
        logger.info(`Validating ${testKey}...`);
        const result = await validator.validate(outputPath, testKey);
        results[testKey] = result;

        if (options.verbose) {
            const status = result.perfect_match ? '✓' : '✗';
            const statusText = result.perfect_match ? 'PASS' : 'FAIL';
            logger.plain(`  ${status} ${testKey}: ${statusText}`);
        }
    }

    logger.info(`Validated ${keys.length} outputs`);

    const summary = {
        total_files_tested: keys.length,
        successful_validations: Object.values(results).filter(r => r.perfect_match).length,
        success_rate: Object.values(results).filter(r => r.perfect_match).length / keys.length
    };

    if (summary.success_rate === 1) {
        logger.success(`Validation complete: ${summary.successful_validations}/${summary.total_files_tested} tests passed`);
    } else {
        logger.error(`Validation failed: ${summary.successful_validations}/${summary.total_files_tested} tests passed (${(summary.success_rate * 100).toFixed(1)}%)`);
    }

    const { getExitCode } = require('../command-utils');
    return summary.success_rate === 1 ? 0 : 1;
}

async function main() {
    const CliParser = require('../cli-parser');
    const parser = new CliParser();
    const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

    const args = process.argv.slice(2);
    const options = parser.parse(args);

    if (options.showHelp) {
        logger.plain(parser.getCommandHelp('compare'));
        return 0;
    }

    let exitCode = 1;

    if (options.testKey && options.output) {
        exitCode = await validateSingle(options);
    } else if (options.outputMap) {
        exitCode = await validateMultiple(options);
    } else {
        logger.error('Invalid arguments. Use --help for usage.');
        return 1;
    }

    process.exit(exitCode);
}

if (require.main === module) {
    main().catch(err => {
        logger.error(`Fatal error: ${err.message}`);
        process.exit(1);
    });
}

module.exports = {
    async execute(options) {
        if (options.verbose) {
            const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
            logger.setLevel('debug');
        }

        if (options.testKey && options.output) {
            return await validateSingle(options);
        } else if (options.outputMap) {
            return await validateMultiple(options);
        } else {
            logger.error('Invalid arguments. Use --help for usage.');
            return 1;
        }
    },

    validateSingle,
    validateMultiple,

    showHelp() {
        const CliParser = require('../cli-parser');
        const parser = new CliParser();
        return parser.getCommandHelp('compare');
    }
};
