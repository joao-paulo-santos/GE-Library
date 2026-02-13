#!/usr/bin/env node

const { cleanup } = require('../../filesystem');
const Logger = require('../../logger');
const config = require('../../config');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

const testExtraction = require('./test-extraction');
const testOptimization = require('./test-optimization');
const testCreation = require('./test-creation');

async function execute(options) {
    logger.info('=== Running All Tests ===\n');

    let exitCode = 0;
    let extractionFailed = false;
    let optimizationFailed = false;
    let creationFailed = false;

    logger.info('\n' + '='.repeat(60));
    logger.info('Running Extraction Tests...');
    logger.info('='.repeat(60));
    const extractionCode = await testExtraction.execute(options);
    if (extractionCode !== 0) {
        extractionFailed = true;
        exitCode = 1;
    }

    logger.info('\n' + '='.repeat(60));
    logger.info('Running Optimization Tests...');
    logger.info('='.repeat(60));
    const optimizationCode = await testOptimization.execute(options);
    if (optimizationCode !== 0) {
        optimizationFailed = true;
        exitCode = 1;
    }

    logger.info('\n' + '='.repeat(60));
    logger.info('Running Creation Tests...');
    logger.info('='.repeat(60));
    const creationCode = await testCreation.execute(options);
    if (creationCode !== 0) {
        creationFailed = true;
        exitCode = 1;
    }

    logger.info('\n' + '='.repeat(60));
    logger.info('=== Overall Test Summary ===');
    logger.info('='.repeat(60));
    logger.info(`Extraction Tests: ${extractionFailed ? '✗ FAILED' : '✓ PASSED'}`);
    logger.info(`Optimization Tests: ${optimizationFailed ? '✗ FAILED' : '✓ PASSED'}`);
    logger.info(`Creation Tests: ${creationFailed ? '✗ FAILED' : '✓ PASSED'}`);
    logger.info('='.repeat(60));

    if (!extractionFailed && !optimizationFailed && !creationFailed) {
        logger.success('All tests passed!');
    } else {
        logger.error('Some tests failed');
    }

    if (!options.keep) {
        cleanup(config.TEMP_DIR);
    }

    return exitCode;
}

function showHelp() {
    return `
test - Run all tests (extraction + optimization + creation)

Usage:
    npm run test
    npm run test -- --verbose
    npm run test -- --keep

Description:
    Runs all tests to validate complete IPF tool functionality against
    reference outputs from original tools.

Options:
    --verbose, -v      Enable detailed output
    --keep              Keep extracted/optimized files for debugging
    --help, -h         Show this help message

Test Suites:
    test-extraction     - Validates IPF extraction against iz.exe + ez.exe
    test-optimization   - Validates IPF optimization against oz.exe
    test-creation       - Validates IPF creation against cz.exe + zi.exe

Individual Tests:
    small    - ai.ipf (4 files)
    medium   - item_texture.ipf (3,063 files)
    large    - ui.ipf (11,568 files)
    optimize - ui.ipf → ui_optimized.ipf (deduplication)
    creation - ui_extracted folder → IPF

Output:
    - Hashes saved to: test_hashes/tools/*/our_hashes.json
    - Test files cleaned up after run (unless --keep)
    `;
}

module.exports = {
    execute,
    showHelp
};
