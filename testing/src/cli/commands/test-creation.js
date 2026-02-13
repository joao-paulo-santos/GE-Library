#!/usr/bin/env node

const { executeCommand } = require('../../executor');
const { calculateDirectoryHash } = require('../../hashing/hash-calculator');
const { fileExists, ensureDir, removeDir, writeJson, readJson, removeFile, cleanup } = require('../../filesystem');
const path = require('path');
const Logger = require('../../logger');
const config = require('../../config');
const { formatBytes } = require('../../generators/base');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

async function execute(options) {
    logger.info('=== Running Creation Test ===\n');

    if (!fileExists(config.CREATION_ORIGINAL_HASHES_PATH)) {
        logger.error(`Original reference hashes not found: ${config.CREATION_ORIGINAL_HASHES_PATH}`);
        logger.info('Please run: npm run generate');
        return 1;
    }

    let originalHashes;
    try {
        originalHashes = readJson(config.CREATION_ORIGINAL_HASHES_PATH);
    } catch (error) {
        logger.error(`Failed to load original hashes: ${error.message}`);
        return 1;
    }

    const ourHashes = {
        generated_at: new Date().toISOString(),
        purpose: 'Hashes from our ipf-creator tool',
        tool: 'ipf-creator (Go implementation)',
        test_files: {}
    };

    const results = { test_run_at: new Date().toISOString(), test_files: {} };

    const creationTests = Object.entries(config.TEST_FILES)
        .filter(([key, fileConfig]) => fileConfig.type === 'creation');

    for (const [key, fileConfig] of creationTests) {
        logger.info(`\n--- Testing ${fileConfig.name} (${key}) ---`);

        if (!fileExists(fileConfig.source)) {
            logger.error(`Source IPF not found: ${fileConfig.source}`);
            results.test_files[key] = { test_file: fileConfig.name, status: 'skipped', error: 'Source IPF not found', timestamp: new Date().toISOString() };
            continue;
        }

        const tempDir = path.join(config.TEMP_DIR, `test_creation_${key}`);
        const sourceFolder = path.join(tempDir, 'source');
        const tempIpf = path.join(tempDir, 'created.ipf');
        const extractDir = path.join(tempDir, 'extracted');

        try {
            cleanup(tempDir);
            ensureDir(sourceFolder);

            logger.info('Extracting source IPF to get source folder...');
            const preExtractResult = await executeCommand(
                config.EXTRACTOR_PATH,
                ['-input', fileConfig.source, '-output', sourceFolder],
                config.EXECUTION_TIMEOUT
            );

            if (!preExtractResult.success) {
                throw new Error(`Pre-extraction failed: ${preExtractResult.error || preExtractResult.stderr}`);
            }

            logger.info('Creating IPF with our tool...');
            const startTime = Date.now();
            const createResult = await executeCommand(
                config.CREATOR_PATH,
                ['-folder', sourceFolder, '-output', tempIpf],
                config.EXECUTION_TIMEOUT
            );
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

            if (!createResult.success) {
                throw new Error(createResult.error || createResult.stderr || 'Unknown error');
            }

            if (!fileExists(tempIpf)) {
                throw new Error('ipf-creator did not create expected IPF file');
            }

            logger.success(`IPF creation completed in ${elapsed}s`);

            logger.info('Extracting created IPF with our extractor...');
            ensureDir(extractDir);
            
            const extractResult = await executeCommand(
                config.EXTRACTOR_PATH,
                ['-input', tempIpf, '-output', extractDir],
                config.EXECUTION_TIMEOUT
            );

            if (!extractResult.success) {
                throw new Error(`Extraction failed: ${extractResult.error || extractResult.stderr}`);
            }

            logger.success('Extraction completed');

            logger.info('Generating hashes from extracted contents...');
            const ourHash = await calculateDirectoryHash(extractDir);
            ourHashes.test_files[key] = { test_file: fileConfig.name, extracted_files: ourHash, timestamp: new Date().toISOString() };

            logger.info('Comparing with reference extracted hashes...');
            const referenceData = originalHashes.test_files[key]?.extracted_files;
            if (!referenceData) {
                logger.error(`No reference data for ${key}`);
                results.test_files[key] = { test_file: fileConfig.name, status: 'no_reference', error: 'No reference data available', timestamp: new Date().toISOString() };
                if (!options.keep) cleanup(tempDir);
                continue;
            }

            const comparison = compareHashes(ourHash, referenceData);
            results.test_files[key] = { test_file: fileConfig.name, status: 'complete', perfect_match: comparison.perfectMatch, ...comparison.details, timestamp: new Date().toISOString() };

            if (comparison.perfectMatch) {
                logger.success(`${key}: Perfect match!`);
            } else {
                logger.error(`${key}: Extracted contents do not match`);
                if (comparison.details.mismatches) {
                    logger.verbose(`Mismatches: ${comparison.details.mismatches.length} files`);
                }
            }

            if (!options.keep) cleanup(tempDir);
        } catch (error) {
            logger.error(`Test failed: ${error.message}`);
            results.test_files[key] = { test_file: fileConfig.name, status: 'failed', error: error.message, timestamp: new Date().toISOString() };
            cleanup(tempDir);
        }
    }

    await writeJson(config.CREATION_OUR_HASHES_PATH, ourHashes, 2);
    logger.info(`Our hashes saved to: ${config.CREATION_OUR_HASHES_PATH}`);

    const totalTests = Object.keys(results.test_files).length;
    const perfectMatches = Object.values(results.test_files).filter(t => t.perfect_match).length;
    const successRate = totalTests > 0 ? (perfectMatches / totalTests) : 0;

    logger.info('\n=== Test Summary ===');
    logger.info(`Total test files: ${totalTests}`);
    logger.info(`Perfect matches: ${perfectMatches}`);
    logger.info(`Success rate: ${(successRate * 100).toFixed(1)}%`);

    return successRate === 1 ? 0 : 1;
}

function compareHashes(ourHash, referenceHash) {
    const details = {
        file_count_match: ourHash.file_count === referenceHash.file_count,
        total_size_match: ourHash.total_size === referenceHash.total_size,
        mismatches: []
    };

    const filesToCompare = ourHash.strategy === 'full' ? ourHash.files : ourHash.sampled_files;
    const referenceFiles = referenceHash.strategy === 'full' ? referenceHash.files : referenceHash.sampled_files;

    for (const [filename, fileData] of Object.entries(filesToCompare)) {
        const refFile = referenceFiles[filename];
        if (!refFile) { details.mismatches.push(`${filename}: Missing in reference`); continue; }
        if (fileData.hash !== refFile.hash) details.mismatches.push(`${filename}: Hash mismatch`);
        if (fileData.size !== refFile.size) details.mismatches.push(`${filename}: Size mismatch`);
    }

    for (const filename of Object.keys(referenceFiles)) {
        if (!filesToCompare[filename]) details.mismatches.push(`${filename}: Missing in our output`);
    }

    return { perfectMatch: details.mismatches.length === 0 && details.file_count_match && details.total_size_match, details };
}

function showHelp() {
    return `
test-creation - Run creation validation test

Usage:
    npm run test:creation
    npm run test:creation -- --verbose
    npm run test:creation -- --keep

Description:
    Creates IPF files from extracted contents using our ipf-creator,
    extracts the result with ipf-extractor, and compares against
    reference hashes from original tools.

Prerequisites:
    - Reference hashes must exist (run: npm run generate)
    - IPF files must be in testing/test_files/
    - ipf-creator and ipf-extractor binaries must be built

Options:
    --verbose, -v      Enable detailed output
    --keep              Keep temp files for debugging
    --help, -h         Show this help message

Test Files:
    ui_creation - ui.ipf

Output:
    - Hashes saved to: test_hashes/tools/creation/our_hashes.json
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
