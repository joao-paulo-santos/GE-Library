#!/usr/bin/env node

/**
 * Generate command implementation
 * Single responsibility: Generate reference hashes by running original tools
 * Saves to test_hashes/tools/extraction/original_hashes.json and test_hashes/tools/optimization/original_hashes.json
 */

const { executeCommand } = require('../../executor');
const { calculateDirectoryHash } = require('../../hashing/hash-calculator');
const { calculateFileHash } = require('../../hash');
const { ensureDir, removeDir, writeJson, getFileInfo, copyFile, moveFile, removeFile, fileExists } = require('../../filesystem');
const path = require('path');
const Logger = require('../../logger');
const config = require('../../config');
const { countIPFFiles } = require('../../count-ipf-files');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

const ORIGINAL_BIN = path.join(config.ORIGINAL_TOOLS_DIR, 'iz.exe');
const REFERENCE_DIR = path.join(__dirname, '../../../reference_original');
const OUTPUT_FILE = config.EXTRACTION_ORIGINAL_HASHES_PATH;
const OZ_BIN = path.join(config.ORIGINAL_TOOLS_DIR, 'oz.exe');
const OPTIMIZATION_OUTPUT_FILE = config.OPTIMIZATION_ORIGINAL_HASHES_PATH;

const testFiles = {
    small: {
        name: 'ai.ipf',
        source: path.join(config.TEST_FILES_DIR, 'ai.ipf')
    },
    medium: {
        name: 'item_texture.ipf',
        source: path.join(config.TEST_FILES_DIR, 'item_texture.ipf')
    },
    large: {
        name: 'ui.ipf',
        source: path.join(config.TEST_FILES_DIR, 'ui.ipf')
    },
    ui_optimized: {
        name: 'ui_optimized.ipf',
        source: path.join(config.TEST_FILES_DIR, 'ui_optimized.ipf'),
        type: 'optimization',
        original_source: path.join(config.TEST_FILES_DIR, 'ui.ipf')
    }
};

async function extractWithOriginalTools(ipfPath, testKey) {
    const ipfFilename = path.basename(ipfPath);
    const ipfBaseName = path.parse(ipfPath).name;

    logger.debug(`Extracting ${ipfFilename} with original tools...`);

    // Step 1: Run iz.exe to convert IPF to ZIP
    // IMPORTANT: iz.exe must be run from directory containing the IPF file
    // It creates .zip in the same directory as the IPF file
    const izResult = await executeCommand(
        ORIGINAL_BIN,
        [ipfFilename],
        config.EXECUTION_TIMEOUT,
        { cwd: config.TEST_FILES_DIR }
    );

    if (!izResult.success) {
        throw new Error(`iz.exe failed: ${izResult.error || izResult.stderr}`);
    }

    const zipPath = path.join(config.TEST_FILES_DIR, `${ipfBaseName}.zip`);

    if (!fileExists(zipPath)) {
        throw new Error(`iz.exe did not create expected ZIP: ${zipPath}`);
    }

    logger.debug(`ZIP created: ${zipPath}`);

    // Step 2: Run ez.exe to extract ZIP to directory
    // IMPORTANT: ez.exe extracts to current working directory
    // It creates directory named after ZIP filename (without .zip extension)
    const ezResult = await executeCommand(
        path.join(config.ORIGINAL_TOOLS_DIR, 'ez.exe'),
        [`${ipfBaseName}.zip`],
        config.EXECUTION_TIMEOUT,
        { cwd: config.TEST_FILES_DIR }
    );

    if (!ezResult.success) {
        // Clean up ZIP before throwing error
        await removeFile(zipPath);
        throw new Error(`ez.exe failed: ${ezResult.error || ezResult.stderr}`);
    }

    // ez.exe creates extraction directory in current working directory
    const extractDir = path.join(config.TEST_FILES_DIR, ipfBaseName);

    if (!fileExists(extractDir)) {
        await removeFile(zipPath);
        throw new Error(`ez.exe did not create extraction directory: ${extractDir}`);
    }

    logger.debug(`Extraction directory: ${extractDir}`);

    // Step 3: Move extraction to reference_original directory
    const targetDir = path.join(REFERENCE_DIR, `${testKey}_original`);

    // Remove existing extraction if it exists
    if (fileExists(targetDir)) {
        await removeDir(targetDir);
    }

    // Create parent directory
    await ensureDir(REFERENCE_DIR);

    // Move extraction to reference_original
    const { spawn } = require('child_process');
    await new Promise((resolve, reject) => {
        const child = spawn('mv', [extractDir, targetDir]);
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Failed to move extraction: mv exited with code ${code}`));
            }
        });
        child.on('error', reject);
    });

    logger.debug(`Moved to: ${targetDir}`);

    // Step 4: Clean up ZIP file
    await removeFile(zipPath);

    return targetDir;
}

async function generateAll(options) {
    logger.info('=== Granado Espada IPF Reference Hash Generation ===');
    logger.info(`Source: ${config.TEST_FILES_DIR}`);

    const extractionResults = {
        generated_at: new Date().toISOString(),
        purpose: 'Reference hashes from original Windows tools (iz.exe + ez.exe)',
        tool: 'Original Windows tools (iz.exe + ez.exe)',
        test_files: {}
    };

    const optimizationResults = {
        generated_at: new Date().toISOString(),
        purpose: 'Reference hashes from oz.exe optimization tool',
        tool: 'oz.exe (IPF Optimizer)',
        test_files: {}
    };

    let extractionSuccess = 0;
    let extractionFailed = 0;
    let optimizationSuccess = 0;
    let optimizationFailed = 0;

    for (const [key, fileConfig] of Object.entries(testFiles)) {
        logger.info(`Processing ${fileConfig.name} (${key})...`);

        try {
            if (fileConfig.type === 'optimization') {
                const result = await generateOptimizationHash(fileConfig, key, options);
                if (result === 0) {
                    optimizationSuccess++;
                } else {
                    optimizationFailed++;
                }
            } else {
                const extractDir = await extractWithOriginalTools(fileConfig.source, key);
                const hashResult = await calculateDirectoryHash(extractDir);

                extractionResults.test_files[key] = {
                    test_file: fileConfig.name,
                    extracted_files: hashResult,
                    timestamp: new Date().toISOString()
                };

                extractionSuccess++;
                logger.success(`Generated hashes for ${fileConfig.name}`);

                if (options.verbose) {
                    logger.plain(`  Files: ${hashResult.file_count}`);
                    logger.plain(`  Total size: ${hashResult.total_size}`);
                    logger.plain(`  Strategy: ${hashResult.strategy}`);
                }
            }
        } catch (error) {
            logger.error(`Failed to process ${fileConfig.name}: ${error.message}`);
            if (fileConfig.type === 'optimization') {
                optimizationFailed++;
            } else {
                extractionFailed++;
                extractionResults.test_files[key] = {
                    test_file: fileConfig.name,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        }
    }

    logger.info('\n=== Saving Reference Databases ===');

    try {
        if (extractionSuccess > 0 || extractionFailed > 0) {
            await writeJson(OUTPUT_FILE, extractionResults, 2);
            logger.success(`Extraction hashes saved to: ${OUTPUT_FILE}`);
        }

        if (optimizationSuccess > 0 || optimizationFailed > 0) {
            logger.info(`Optimization hashes saved to: ${OPTIMIZATION_OUTPUT_FILE}`);
        }

        logger.info('\n=== Summary ===');
        if (extractionSuccess > 0 || extractionFailed > 0) {
            logger.info(`Extraction - Successful: ${extractionSuccess}, Failed: ${extractionFailed}`);
        }
        if (optimizationSuccess > 0 || optimizationFailed > 0) {
            logger.info(`Optimization - Successful: ${optimizationSuccess}, Failed: ${optimizationFailed}`);
        }

        return (extractionFailed === 0 && optimizationFailed === 0) ? 0 : 1;
    } catch (error) {
        logger.error(`Failed to save reference hashes: ${error.message}`);
        return 1;
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

async function generateOptimizationHash(testConfig, testKey, options) {
    logger.info(`Generating optimization hashes for ${testConfig.name}...`);
    try {
        const tempIpfPath = path.join(config.TEST_FILES_DIR, `temp_${testKey}.ipf`);
        logger.debug(`Copying ${testConfig.original_source} to ${tempIpfPath}`);
        copyFile(testConfig.original_source, tempIpfPath);

        logger.debug(`Running oz.exe on ${tempIpfPath}...`);
        const ozResult = await executeCommand(
            OZ_BIN,
            [path.basename(tempIpfPath)],
            config.EXECUTION_TIMEOUT,
            { cwd: config.TEST_FILES_DIR }
        );

        if (!ozResult.success) {
            throw new Error(`oz.exe failed: ${ozResult.error || ozResult.stderr}`);
        }
        logger.debug(`oz.exe output: ${ozResult.stdout}`);

        removeFile(testConfig.source);

        logger.debug(`Moving optimized IPF to ${testConfig.source}...`);
        moveFile(tempIpfPath, testConfig.source);

        const optimizedHash = await calculateFileHash(testConfig.source);
        const optimizedStats = getFileInfo(testConfig.source);

        const originalHash = await calculateFileHash(testConfig.original_source);
        const originalStats = getFileInfo(testConfig.original_source);

        const sizeReductionBytes = originalStats.size - optimizedStats.size;
        const sizeReductionPercent = (sizeReductionBytes / originalStats.size) * 100;

        const optimizedFileCount = countIPFFiles(testConfig.source);
        const originalFileCount = countIPFFiles(testConfig.original_source);

        const reduction = {
            size_reduction_bytes: sizeReductionBytes,
            size_reduction_percent: Math.round(sizeReductionPercent * 10) / 10,
            file_reduction_count: originalFileCount - optimizedFileCount
        };

        const results = {
            generated_at: new Date().toISOString(),
            purpose: 'Reference hashes from oz.exe optimization tool',
            tool: 'oz.exe (IPF Optimizer)',
            test_files: {}
        };
        results.test_files[testKey] = {
            original: {
                test_file: path.basename(testConfig.original_source),
                size_bytes: originalStats.size,
                file_count: originalFileCount,
                sha256: originalHash
            },
            optimized: {
                test_file: testConfig.name,
                size_bytes: optimizedStats.size,
                file_count: optimizedFileCount,
                sha256: optimizedHash
            },
            reduction: reduction,
            timestamp: new Date().toISOString()
        };
        await writeJson(OPTIMIZATION_OUTPUT_FILE, results, 2);
        logger.success(`Optimization hashes generated successfully`);
        logger.info(`Database saved to: ${OPTIMIZATION_OUTPUT_FILE}`);
        if (options.verbose) {
            logger.plain(`  Original: ${formatBytes(originalStats.size)} (${originalHash.substring(0, 8)}...)`);
            logger.plain(`  Optimized: ${formatBytes(optimizedStats.size)} (${optimizedHash.substring(0, 8)}...)`);
            logger.plain(`  Reduction: ${formatBytes(sizeReductionBytes)} (${sizeReductionPercent.toFixed(1)}%)`);
        }
        return 0;
    } catch (error) {
        logger.error(`Optimization hash generation failed: ${error.message}`);
        logger.error(`Generation failed: ${error.message}`);
        removeFile(path.join(config.TEST_FILES_DIR, `temp_${testKey}.ipf`));
        return 1;
    }
}

async function main() {
    const CliParser = require('../cli-parser');
    const parser = new CliParser();
    const options = parser.parse(process.argv.slice(2));

    if (options.showHelp) {
        logger.plain(parser.getCommandHelp('generate'));
        return 0;
    }

    const exitCode = await generateAll(options);
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
        if (options.showHelp) {
            const CliParser = require('../cli-parser');
            const parser = new CliParser();
            logger.plain(parser.getCommandHelp('generate'));
            return 0;
        }

        return await generateAll(options);
    },

    generateOptimizationHash,
    generateAll,

    showHelp() {
        const CliParser = require('../cli-parser');
        const parser = new CliParser();
        return parser.getCommandHelp('generate');
    }
};
