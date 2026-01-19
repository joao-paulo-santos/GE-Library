#!/usr/bin/env node

/**
 * Compare command implementation
 * Single responsibility: Compare pre-existing outputs with reference hashes
 */

const ExtractValidator = require('../../validation/extract-validator');
const { fileExists } = require('../../filesystem');
const ConsoleReporter = require('../../reporting/console-reporter');
const Logger = require('../../logger');
const config = require('../../config');

async function validateSingle(options) {
    const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
    const consoleReporter = new ConsoleReporter(logger);

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

    return result.perfect_match ? 0 : 1;
}

async function validateMultiple(options) {
    const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
    const consoleReporter = new ConsoleReporter(logger);

    if (!options.outputMap) {
        logger.error('Missing required option: --output-map');
        consoleReporter.printError('Missing required option: --output-map');
        return 1;
    }

    try {
        const outputMap = JSON.parse(options.outputMap);
    } catch (error) {
        logger.error(`Invalid --output-map JSON: ${error.message}`);
        consoleReporter.printError(`Invalid --output-map JSON: ${error.message}`);
        return 1;
    }

    const referencePath = options.reference || config.EXTRACTION_ORIGINAL_HASHES_PATH;

    if (!fileExists(referencePath)) {
        logger.error(`Reference hashes not found: ${referencePath}`);
        consoleReporter.printError(`Reference hashes not found: ${referencePath}`);
        return 1;
    }

    const validator = new ExtractValidator(referencePath, logger);
    const results = {};
    const keys = Object.keys(outputMap);

    for (const [key, outputPath] of Object.entries(outputMap)) {
        logger.info(`Validating ${key}...`);
        const result = await validator.validate(outputPath, key);
        results[key] = result;

        if (options.verbose) {
            const status = result.perfect_match ? '✓' : '✗';
            const statusText = result.perfect_match ? 'PASS' : 'FAIL';
            console.log(`  ${status} ${key}: ${statusText}`);
        }
    }

    consoleReporter.printInfo(`Validated ${keys.length} outputs`);

    const summary = {
        total_files_tested: keys.length,
        successful_validations: Object.values(results).filter(r => r.perfect_match).length,
        success_rate: Object.values(results).filter(r => r.perfect_match).length / keys.length
    };

    consoleReporter.printValidationSummary(summary);

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
        console.log(parser.getCommandHelp('compare'));
        return 0;
    }

    let exitCode = 1;

    if (options.testKey && options.output) {
        exitCode = await validateSingle(options);
    } else if (options.outputMap) {
        exitCode = await validateMultiple(options);
    } else {
        logger.error('Invalid arguments. Use --help for usage.');
        const consoleReporter = new ConsoleReporter(logger);
        consoleReporter.printError('Invalid arguments. Use --help for usage.');
    }

    process.exit(exitCode);
}

if (require.main === module) {
    main().catch(err => {
        const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
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
            const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
            const consoleReporter = new ConsoleReporter(logger);
            logger.error('Invalid arguments. Use --help for usage.');
            consoleReporter.printError('Invalid arguments. Use --help for usage.');
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
