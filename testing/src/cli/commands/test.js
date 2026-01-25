#!/usr/bin/env node

const { executeCommand } = require('../../executor');
const { calculateDirectoryHash } = require('../../hashing/hash-calculator');
const { fileExists, ensureDir, removeDir, writeJson } = require('../../filesystem');
const Logger = require('../../logger');
const config = require('../../config');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

async function saveOurHashes(ourHashes) {
    const results = {
        generated_at: new Date().toISOString(),
        purpose: 'Hashes from our Go IPF extractor',
        tool: 'Our Go IPF extractor',
        test_files: ourHashes
    };

    await writeJson(config.EXTRACTION_OUR_HASHES_PATH, results, 2);
    logger.info(`Our hashes saved to: ${config.EXTRACTION_OUR_HASHES_PATH}`);
}

async function execute(options) {
    logger.info('=== Running Full Extraction Test ===\n');

    const originalReferencePath = config.EXTRACTION_ORIGINAL_HASHES_PATH;

    if (!fileExists(originalReferencePath)) {
        logger.error(`Original reference hashes not found: ${originalReferencePath}`);
        logger.info('Please run: node cli.js generate');
        return 1;
    }

    let originalHashes;
    try {
        originalHashes = await require('fs').promises.readFile(originalReferencePath, 'utf8');
        originalHashes = JSON.parse(originalHashes);
    } catch (error) {
        logger.error(`Failed to load original hashes: ${error.message}`);
        return 1;
    }

    const ourHashes = {};
    const results = {
        test_run_at: new Date().toISOString(),
        test_files: {}
    };

    for (const [key, fileConfig] of Object.entries(config.TEST_FILES)) {
        logger.info(`\n--- Testing ${fileConfig.name} (${key}) ---`);

        if (!fileExists(fileConfig.source)) {
            logger.error(`Source IPF not found: ${fileConfig.source}`);
            results.test_files[key] = {
                test_file: fileConfig.name,
                status: 'skipped',
                error: 'Source IPF not found',
                timestamp: new Date().toISOString()
            };
            continue;
        }

        try {
            await ensureDir(fileConfig.output);
        } catch (error) {
            logger.error(`Failed to create output directory: ${error.message}`);
            results.test_files[key] = {
                test_file: fileConfig.name,
                status: 'extraction_failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
            continue;
        }

        logger.info('Extracting with our tool...');

        try {
            const startTime = Date.now();
            const result = await executeCommand(
                config.EXTRACTOR_PATH,
                ['-input', fileConfig.source, '-output', fileConfig.output],
                config.EXECUTION_TIMEOUT
            );

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

            if (!result.success) {
                throw new Error(result.error || result.stderr || 'Unknown error');
            }

            logger.success(`Extraction completed in ${elapsed}s`);
        } catch (error) {
            logger.error(`Extraction failed: ${error.message}`);
            results.test_files[key] = {
                test_file: fileConfig.name,
                status: 'extraction_failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
            continue;
        }

        logger.info('Generating hashes from our output...');

        let ourHash;
        try {
            ourHash = await calculateDirectoryHash(fileConfig.output);
            ourHashes[key] = {
                test_file: fileConfig.name,
                extracted_files: ourHash,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Failed to generate hashes: ${error.message}`);
            results.test_files[key] = {
                test_file: fileConfig.name,
                status: 'hash_generation_failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
            continue;
        }

        logger.info('Comparing with original reference hashes...');

        const referenceData = originalHashes.test_files[key]?.extracted_files;
        if (!referenceData) {
            logger.error(`No reference data for ${key}`);
            results.test_files[key] = {
                test_file: fileConfig.name,
                status: 'no_reference',
                error: 'No reference data available',
                timestamp: new Date().toISOString()
            };
            continue;
        }

        const comparison = await compareHashes(ourHash, referenceData);

        results.test_files[key] = {
            test_file: fileConfig.name,
            status: 'complete',
            perfect_match: comparison.perfectMatch,
            ...comparison.details,
            timestamp: new Date().toISOString()
        };

        if (comparison.perfectMatch) {
            logger.success(`${key}: Perfect match!`);
        } else {
            logger.error(`${key}: Files do not match`);
            if (options.verbose && comparison.details.mismatches) {
                logger.info(`Mismatches: ${comparison.details.mismatches.length} files`);
            }
        }
    }

    await saveOurHashes(ourHashes);

    logger.info('\n=== Test Summary ===');

    const totalTests = Object.keys(results.test_files).length;
    const perfectMatches = Object.values(results.test_files).filter(t => t.perfect_match).length;
    const successRate = totalTests > 0 ? (perfectMatches / totalTests) : 0;

    logger.info(`Total test files: ${totalTests}`);
    logger.info(`Perfect matches: ${perfectMatches}`);
    logger.info(`Success rate: ${(successRate * 100).toFixed(1)}%`);

    if (!options.keep) {
        logger.info('\n=== Cleaning Up ===');
        for (const [key, fileConfig] of Object.entries(config.TEST_FILES)) {
            if (fileExists(fileConfig.output)) {
                try {
                    await removeDir(fileConfig.output);
                    logger.info(`Removed: ${fileConfig.output}`);
                } catch (error) {
                    logger.error(`Failed to remove ${fileConfig.output}: ${error.message}`);
                }
            }
        }
        logger.info('Cleanup complete');
    } else {
        logger.info('\n=== Keeping Extracted Files ===');
        logger.info('Extracted files in: reference_our/');
    }

    return successRate === 1 ? 0 : 1;
}

async function compareHashes(ourHash, referenceHash) {
    const details = {
        file_count_match: ourHash.file_count === referenceHash.file_count,
        total_size_match: ourHash.total_size === referenceHash.total_size,
        mismatches: []
    };

    const filesToCompare = ourHash.strategy === 'full' ? ourHash.files : ourHash.sampled_files;
    const referenceFiles = referenceHash.strategy === 'full' ? referenceHash.files : referenceHash.sampled_files;

    for (const [filename, fileData] of Object.entries(filesToCompare)) {
        const refFile = referenceFiles[filename];

        if (!refFile) {
            details.mismatches.push(`${filename}: Missing in reference`);
            continue;
        }

        if (fileData.hash !== refFile.hash) {
            details.mismatches.push(`${filename}: Hash mismatch`);
        }

        if (fileData.size !== refFile.size) {
            details.mismatches.push(`${filename}: Size mismatch (${fileData.size} vs ${refFile.size})`);
        }
    }

    for (const filename of Object.keys(referenceFiles)) {
        if (!filesToCompare[filename]) {
            details.mismatches.push(`${filename}: Missing in our output`);
        }
    }

    const perfectMatch = details.mismatches.length === 0 &&
                        details.file_count_match &&
                        details.total_size_match;

    return { perfectMatch, details };
}

function showHelp() {
    return `
test - Run complete extraction and validation test

Usage:
    node cli.js test [options]

Description:
    Extracts all test IPF files using our tool, saves hashes to
    our_extraction_hashes.json, and compares against reference hashes from
    original Windows tools. Extracted files are cleaned up after tests
    complete (use --keep to preserve for debugging).

Prerequisites:
    - Reference hashes must exist (run: node cli.js generate)
    - IPF files must be in testing/test_files/
    - IPF extractor binary must be built

Options:
    --verbose, -v      Enable detailed output
    --keep              Keep extracted files for debugging (otherwise cleaned up)
    --help, -h         Show this help message

Test Files:
    small    - ai.ipf (4 files)
    medium   - item_texture.ipf (3,063 files)
    large    - ui.ipf (11,567 files)

Output:
    - Hashes saved to: test_hashes/tools/extraction/our_hashes.json
    - Extracted files: reference_our/ (cleaned up unless --keep)
    `;
}

module.exports = {
    execute,
    showHelp
};
