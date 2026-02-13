#!/usr/bin/env node

const { executeCommand } = require('../../executor');
const { ensureDir, removeDir, fileExists, getFileInfo, copyFile, writeJson, readJson, cleanup } = require('../../filesystem');
const { calculateFileHash } = require('../../hash');
const path = require('path');
const Logger = require('../../logger');
const config = require('../../config');
const { countIPFFiles } = require('../../count-ipf-files');
const { formatBytes } = require('../../generators/base');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

async function execute(options) {
    logger.info('=== Running Optimization Test ===\n');

    if (!fileExists(config.OPTIMIZATION_ORIGINAL_HASHES_PATH)) {
        logger.error(`Original reference hashes not found: ${config.OPTIMIZATION_ORIGINAL_HASHES_PATH}`);
        logger.info('Please run: npm run generate');
        return 1;
    }

    let originalHashes;
    try {
        originalHashes = readJson(config.OPTIMIZATION_ORIGINAL_HASHES_PATH);
    } catch (error) {
        logger.error(`Failed to load original hashes: ${error.message}`);
        return 1;
    }

    const ourHashes = {
        generated_at: new Date().toISOString(),
        purpose: 'Hashes from our ipf-optimizer tool',
        tool: 'ipf-optimizer (Go implementation)',
        test_files: {}
    };

    const results = { test_run_at: new Date().toISOString(), test_files: {} };

    const optimizationTests = Object.entries(config.TEST_FILES)
        .filter(([key, fileConfig]) => fileConfig.type === 'optimization');

    for (const [key, fileConfig] of optimizationTests) {
        logger.info(`\n--- Testing ${fileConfig.name} (${key}) ---`);

        if (!fileExists(fileConfig.source)) {
            logger.error(`Source IPF not found: ${fileConfig.source}`);
            results.test_files[key] = { test_file: fileConfig.name, status: 'skipped', error: 'Source IPF not found', timestamp: new Date().toISOString() };
            continue;
        }

        const tempDir = path.join(config.TEMP_DIR, `test_optimization_${key}`);
        const tempIpf = path.join(tempDir, 'source.ipf');

        try {
            cleanup(tempDir);
            ensureDir(tempDir);

            logger.info('Copying source IPF...');
            copyFile(fileConfig.source, tempIpf);

            logger.info('Running our optimizer...');
            const startTime = Date.now();
            const optimizerResult = await executeCommand(
                config.OPTIMIZER_PATH,
                ['--backup', tempIpf],
                config.EXECUTION_TIMEOUT
            );
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

            if (!optimizerResult.success) {
                throw new Error(optimizerResult.stderr || optimizerResult.error || 'Unknown error');
            }

            logger.success(`Optimization completed in ${elapsed}s`);

            const optimizedStats = getFileInfo(tempIpf);
            const optimizedHash = await calculateFileHash(tempIpf);
            const optimizedFileCount = countIPFFiles(tempIpf);

            logger.info(`Our optimized: ${formatBytes(optimizedStats.size)} (${optimizedHash.substring(0, 8)}...), ${optimizedFileCount} files`);

            const referenceData = originalHashes.test_files[key]?.optimized;
            if (!referenceData) {
                logger.error(`No reference data for ${key}`);
                results.test_files[key] = { test_file: fileConfig.name, status: 'no_reference', error: 'No reference data available', timestamp: new Date().toISOString() };
                cleanup(tempDir);
                continue;
            }

            logger.info(`Reference oz.exe: ${formatBytes(referenceData.size_bytes)} (${referenceData.sha256.substring(0, 8)}...), ${referenceData.file_count} files`);

            const hashMatch = optimizedHash === referenceData.sha256;
            const sizeMatch = Math.abs(optimizedStats.size - referenceData.size_bytes) === 0;
            const countMatch = optimizedFileCount === referenceData.file_count;

            logger.info('\nComparison:');
            logger.info(`  Hash match: ${hashMatch ? '✓' : '✗'}`);
            logger.info(`  Size match: ${sizeMatch ? '✓' : '✗'}`);
            logger.info(`  File count match: ${countMatch ? '✓' : '✗'}`);

            const perfectMatch = hashMatch && sizeMatch && countMatch;

            ourHashes.test_files[key] = {
                optimized: { test_file: fileConfig.name, size_bytes: optimizedStats.size, file_count: optimizedFileCount, sha256: optimizedHash },
                validation: { hash_match: hashMatch, size_match: sizeMatch, count_match: countMatch, perfect_match: perfectMatch },
                timestamp: new Date().toISOString()
            };

            results.test_files[key] = { test_file: fileConfig.name, status: 'complete', perfect_match: perfectMatch, hash_match: hashMatch, size_match: sizeMatch, count_match: countMatch, timestamp: new Date().toISOString() };

            if (perfectMatch) {
                logger.success(`${key}: Perfect match!`);
            } else {
                logger.error(`${key}: Validation failed`);
            }

            cleanup(tempDir);
        } catch (error) {
            logger.error(`Test failed: ${error.message}`);
            results.test_files[key] = { test_file: fileConfig.name, status: 'failed', error: error.message, timestamp: new Date().toISOString() };
            cleanup(tempDir);
        }
    }

    await writeJson(config.OPTIMIZATION_OUR_HASHES_PATH, ourHashes, 2);
    logger.info(`Our hashes saved to: ${config.OPTIMIZATION_OUR_HASHES_PATH}`);

    const totalTests = Object.keys(results.test_files).length;
    const perfectMatches = Object.values(results.test_files).filter(t => t.perfect_match).length;
    const successRate = totalTests > 0 ? (perfectMatches / totalTests) : 0;

    logger.info('\n=== Test Summary ===');
    logger.info(`Total test files: ${totalTests}`);
    logger.info(`Perfect matches: ${perfectMatches}`);
    logger.info(`Success rate: ${(successRate * 100).toFixed(1)}%`);

    return successRate === 1 ? 0 : 1;
}

function showHelp() {
    return `
test-optimization - Run optimization validation test

Usage:
    npm run test:optimization
    npm run test:optimization -- --verbose

Description:
    Optimizes IPF files using our ipf-optimizer tool and compares
    against reference oz.exe output (hash, size, file count).

Prerequisites:
    - Reference hashes must exist (run: npm run generate)
    - IPF files must be in testing/test_files/
    - ipf-optimizer binary must be built

Options:
    --verbose, -v      Enable detailed output
    --help, -h         Show this help message

Test Files:
    ui_optimization - ui.ipf

Output:
    - Hashes saved to: test_hashes/tools/optimization/our_hashes.json
    `;
}

async function main() {
    const CliParser = require('../cli-parser');
    const parser = new CliParser();
    const options = parser.parse(process.argv.slice(2));

    if (options.showHelp) {
        console.log(showHelp());
        return 0;
    }

    return await execute(options);
}

if (require.main === module) {
    main().catch(err => {
        logger.error(`Fatal error: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { execute, showHelp };
