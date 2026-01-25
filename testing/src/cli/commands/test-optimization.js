#!/usr/bin/env node

const { executeCommand } = require('../../executor');
const { ensureDir, removeDir, fileExists, getFileInfo, copyFile } = require('../../filesystem');
const { calculateFileHash } = require('../../hash');
const { readJson } = require('../../filesystem');
const path = require('path');
const Logger = require('../../logger');
const config = require('../../config');
const { countIPFFiles } = require('../../count-ipf-files');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

const OPTIMIZER_BIN = config.OPTIMIZER_PATH;
const OPTIMIZATION_ORIGINAL_HASHES = config.OPTIMIZATION_ORIGINAL_HASHES_PATH;

const testFiles = {
    ui_optimized: {
        name: 'ui_optimized.ipf',
        source: path.join(config.TEST_FILES_DIR, 'ui_optimized.ipf'),
        type: 'optimization',
        original_source: path.join(config.TEST_FILES_DIR, 'ui.ipf')
    }
};

async function runOptimizationTest(testKey, options) {
    const testConfig = testFiles[testKey];
    if (!testConfig) {
        logger.error(`Unknown test file: ${testKey}`);
        return 1;
    }

    logger.info(`=== Testing ${testKey} ===`);

    const tempDir = path.join(config.TEST_FILES_DIR, `temp_opt_${Date.now()}`);
    ensureDir(tempDir);

    try {
        const tempOriginal = path.join(tempDir, path.basename(testConfig.original_source));

        logger.info(`Copying original IPF...`);
        copyFile(testConfig.original_source, tempOriginal);

        logger.info(`Running our optimizer...`);
        const startTime = Date.now();
        const optimizerResult = await executeCommand(
            OPTIMIZER_BIN,
            ['--backup', tempOriginal],
            config.EXECUTION_TIMEOUT
        );
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        if (!optimizerResult.success) {
            logger.error(`Optimizer failed: ${optimizerResult.stderr || optimizerResult.error}`);
            return 1;
        }

        logger.success(`Optimization completed in ${elapsed}s`);

        const optimizedPath = tempOriginal;
        const optimizedStats = getFileInfo(optimizedPath);
        const optimizedHash = await calculateFileHash(optimizedPath);
        const optimizedFileCount = countIPFFiles(optimizedPath);

        logger.info(`Our optimized: ${formatBytes(optimizedStats.size)} (${optimizedHash.substring(0, 8)}...), ${optimizedFileCount} files`);

        const referenceHashes = readJson(config.OPTIMIZATION_ORIGINAL_HASHES_PATH);
        const referenceData = referenceHashes.test_files[testKey];

        if (!referenceData) {
            logger.error(`No reference data found for ${testKey}`);
            return 1;
        }

        const { optimized } = referenceData;

        logger.info(`Reference oz.exe: ${formatBytes(optimized.size_bytes)} (${optimized.sha256.substring(0, 8)}...), ${optimized.file_count} files`);

        const hashMatch = optimizedHash === optimized.sha256;
        const sizeMatch = Math.abs(optimizedStats.size - optimized.size_bytes) === 0;
        const countMatch = optimizedFileCount === optimized.file_count;

        logger.info(`\nComparison:`);
        logger.info(`  Hash match: ${hashMatch ? '✓' : '✗'}`);
        logger.info(`  Size match: ${sizeMatch ? '✓' : '✗'}`);
        logger.info(`  File count match: ${countMatch ? '✓' : '✗'}`);

        const perfectMatch = hashMatch && sizeMatch && countMatch;

        if (perfectMatch) {
            logger.success(`✓ ${testKey}: Perfect match!`);
        } else {
            logger.error(`✗ ${testKey}: Validation failed`);
        }

        return perfectMatch ? 0 : 1;
    } catch (error) {
        logger.error(`Test failed: ${error.message}`);
        return 1;
    } finally {
        if (fileExists(tempDir)) {
            removeDir(tempDir);
        }
    }
}

function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

async function main() {
    const CliParser = require('../cli-parser');
    const parser = new CliParser();
    const options = parser.parse(process.argv.slice(2));

    if (options.showHelp) {
        console.log('test-optimization [options] [test-key]\n');
        console.log('Test IPF optimization against reference oz.exe output.\n');
        console.log('Options:');
        console.log('  --verbose, -v     Enable detailed output');
        console.log('  --quiet, -q       Suppress console output');
        console.log('  --help, -h        Show this help message');
        console.log('\nTest keys:');
        Object.keys(testFiles).forEach(key => {
            console.log(`  ${key}`);
        });
        console.log('\nExample:');
        console.log('  node cli.js test-optimization ui_optimized');
        return 0;
    }

    const testKey = options.testKey || 'ui_optimized';
    return await runOptimizationTest(testKey, options);
}

if (require.main === module) {
    main().catch(err => {
        logger.error(`Fatal error: ${err.message}`);
        process.exit(1);
    });
}

module.exports = {
    async execute(options) {
        const testKey = options.testKey || 'ui_optimized';
        return await runOptimizationTest(testKey, options);
    },

    showHelp() {
        return 'test-optimization [options] [test-key]\n\n' +
            'Test IPF optimization against reference oz.exe output.\n\n' +
            'Options:\n' +
            '  --verbose, -v     Enable detailed output\n' +
            '  --quiet, -q       Suppress console output\n' +
            '  --help, -h        Show this help message\n\n' +
            'Test keys:\n' +
            Object.keys(testFiles).map(key => `  ${key}`).join('\n') +
            '\n\nExample:\n' +
            '  node cli.js test-optimization ui_optimized';
    }
};
