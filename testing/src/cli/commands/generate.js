#!/usr/bin/env node

/**
 * Generate command implementation
 * Single responsibility: Generate reference hashes by running original tools (iz.exe + ez.exe)
 * Saves to test_hashes/tools/original_extraction_hashes.json
 */

const { executeCommand } = require('../../executor');
const { calculateDirectoryHash } = require('../../hashing/hash-calculator');
const { ensureDir, removeDir, writeJson } = require('../../filesystem');
const path = require('path');
const ConsoleReporter = require('../../reporting/console-reporter');
const Logger = require('../../logger');
const config = require('../../config');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
const consoleReporter = new ConsoleReporter(logger);

const ORIGINAL_BIN = path.join(config.ORIGINAL_TOOLS_DIR, 'iz.exe');
const REFERENCE_DIR = path.join(__dirname, '../../../reference_original');
const OUTPUT_FILE = config.EXTRACTION_ORIGINAL_HASHES_PATH;

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

    if (!await checkFileExists(zipPath)) {
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

    if (!await checkFileExists(extractDir)) {
        await removeFile(zipPath);
        throw new Error(`ez.exe did not create extraction directory: ${extractDir}`);
    }

    logger.debug(`Extraction directory: ${extractDir}`);

    // Step 3: Move extraction to reference_original directory
    const targetDir = path.join(REFERENCE_DIR, `${testKey}_original`);

    // Remove existing extraction if it exists
    if (await checkFileExists(targetDir)) {
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

async function checkFileExists(filePath) {
    const { fileExists } = require('../../filesystem');
    return fileExists(filePath);
}

async function removeFile(filePath) {
    const fs = require('fs');
    try {
        fs.unlinkSync(filePath);
    } catch (error) {
        logger.warn(`Failed to remove ${filePath}: ${error.message}`);
    }
}

async function generateSingle(options) {
    const testKey = options.testKey || 'small';
    const testConfig = testFiles[testKey];

    if (!testConfig) {
        consoleReporter.printError(`Invalid test key: ${testKey}`);
        return 1;
    }

    consoleReporter.printInfo(`Generating reference hashes for ${testConfig.name}...`);

    try {
        // Extract with original tools
        const extractDir = await extractWithOriginalTools(testConfig.source);

        // Hash the extraction
        const hashResult = await calculateDirectoryHash(extractDir);

        const results = {
            generated_at: new Date().toISOString(),
            purpose: 'Reference hashes from original Windows tools (iz.exe + ez.exe)',
            tool: 'Original Windows tools (iz.exe + ez.exe)',
            test_files: {}
        };

        results.test_files[testKey] = {
            test_file: testConfig.name,
            extracted_files: hashResult,
            timestamp: new Date().toISOString()
        };

        await writeJson(OUTPUT_FILE, results, 2);

        consoleReporter.printSuccess(`Reference hashes generated successfully`);
        consoleReporter.printInfo(`Database saved to: ${OUTPUT_FILE}`);

        if (options.verbose) {
            console.log(`  Files: ${hashResult.file_count}`);
            console.log(`  Total size: ${hashResult.total_size}`);
            console.log(`  Strategy: ${hashResult.strategy}`);
        }

        return 0;
    } catch (error) {
        logger.error(`Generation failed: ${error.message}`);
        consoleReporter.printError(`Generation failed: ${error.message}`);
        return 1;
    }
}

async function generateAll(options) {
    consoleReporter.printInfo('=== Granado Espada IPF Reference Hash Generation ===');
    consoleReporter.printInfo(`Tool: Original Windows tools (iz.exe + ez.exe)`);
    consoleReporter.printInfo(`Source: ${config.TEST_FILES_DIR}`);
    consoleReporter.printInfo(`Output: ${OUTPUT_FILE}`);

    const results = {
        generated_at: new Date().toISOString(),
        purpose: 'Reference hashes from original Windows tools (iz.exe + ez.exe)',
        tool: 'Original Windows tools (iz.exe + ez.exe)',
        test_files: {}
    };

    for (const [key, fileConfig] of Object.entries(testFiles)) {
        consoleReporter.printInfo(`Processing ${fileConfig.name} (${key})...`);

        try {
            // Extract with original tools
            const extractDir = await extractWithOriginalTools(fileConfig.source, key);

            // Hash the extraction
            const hashResult = await calculateDirectoryHash(extractDir);

            results.test_files[key] = {
                test_file: fileConfig.name,
                extracted_files: hashResult,
                timestamp: new Date().toISOString()
            };

            consoleReporter.printSuccess(`Generated hashes for ${fileConfig.name}`);

            if (options.verbose) {
                console.log(`  Files: ${hashResult.file_count}`);
                console.log(`  Total size: ${hashResult.total_size}`);
                console.log(`  Strategy: ${hashResult.strategy}`);
            }
        } catch (error) {
            consoleReporter.printError(`Failed to process ${fileConfig.name}: ${error.message}`);
            results.test_files[key] = {
                test_file: fileConfig.name,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    consoleReporter.printInfo('\n=== Saving Reference Database ===');
    consoleReporter.printInfo(`Output: ${OUTPUT_FILE}`);

    try {
        await writeJson(OUTPUT_FILE, results, 2);
        consoleReporter.printSuccess('Reference hashes saved successfully');

        const successCount = Object.values(results.test_files).filter(t => !t.error).length;
        const totalCount = Object.keys(results.test_files).length;

        consoleReporter.printInfo(`\n=== Summary ===`);
        consoleReporter.printInfo(`Total test files: ${totalCount}`);
        consoleReporter.printInfo(`Successful: ${successCount}`);
        consoleReporter.printInfo(`Failed: ${totalCount - successCount}`);

        return 0;
    } catch (error) {
        consoleReporter.printError(`Failed to save reference hashes: ${error.message}`);
        return 1;
    }
}

async function main() {
    const CliParser = require('../cli-parser');
    const parser = new CliParser();
    const options = parser.parse(process.argv.slice(2));

    if (options.showHelp) {
        console.log(parser.getCommandHelp('generate'));
        return 0;
    }

    let exitCode = 1;

    if (options.testKey) {
        exitCode = await generateSingle(options);
    } else {
        exitCode = await generateAll(options);
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
        if (options.showHelp) {
            const CliParser = require('../cli-parser');
            const parser = new CliParser();
            console.log(parser.getCommandHelp('generate'));
            return 0;
        }

        if (options.testKey) {
            return await generateSingle(options);
        } else {
            return await generateAll(options);
        }
    },

    generateSingle,
    generateAll,

    showHelp() {
        const CliParser = require('../cli-parser');
        const parser = new CliParser();
        return parser.getCommandHelp('generate');
    }
};
