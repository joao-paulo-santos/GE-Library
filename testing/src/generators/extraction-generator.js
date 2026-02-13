const { executeCommand } = require('../executor');
const { calculateDirectoryHash } = require('../hashing/hash-calculator');
const { ensureDir, removeDir, removeFile, moveFile, fileExists, cleanup } = require('../filesystem');
const path = require('path');
const Logger = require('../logger');
const config = require('../config');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

async function extractWithOriginalTools(ipfPath, tempDir) {
    const ipfFilename = path.basename(ipfPath);
    const ipfBaseName = path.parse(ipfPath).name;

    const zipPath = path.join(config.TEST_FILES_DIR, `${ipfBaseName}.zip`);
    const extractDir = path.join(config.TEST_FILES_DIR, ipfBaseName);
    const targetDir = path.join(tempDir, 'extracted');

    cleanup(zipPath, extractDir, targetDir);

    logger.debug(`Extracting ${ipfFilename} with original tools...`);

    const izResult = await executeCommand(
        config.IZ_BIN,
        [ipfFilename],
        config.EXECUTION_TIMEOUT,
        { cwd: config.TEST_FILES_DIR }
    );

    if (!izResult.success) {
        throw new Error(`iz.exe failed: ${izResult.error || izResult.stderr}`);
    } else if (!fileExists(zipPath)) {
        throw new Error(`iz.exe did not create expected ZIP: ${zipPath}`);
    }

    logger.debug(`ZIP created: ${zipPath}`);

    try {
        const ezResult = await executeCommand(
            config.EZ_BIN,
            [`${ipfBaseName}.zip`],
            config.EXECUTION_TIMEOUT,
            { cwd: config.TEST_FILES_DIR }
        );

        if (!ezResult.success) {
            throw new Error(`ez.exe failed: ${ezResult.error || ezResult.stderr}`);
        }

        if (!fileExists(extractDir)) {
            throw new Error(`ez.exe did not create extraction directory: ${extractDir}`);
        }

        logger.debug(`Extraction directory: ${extractDir}`);

        ensureDir(tempDir);
        moveFile(extractDir, targetDir);
        logger.debug(`Moved to: ${targetDir}`);

        return targetDir;
    } finally {
        removeFile(zipPath);
    }
}

async function generate(testConfig, testKey, options) {
    logger.info(`Generating extraction hashes for ${testConfig.name}...`);
    
    const tempDir = path.join(config.TEMP_DIR, `extraction_${testKey}`);
    const result = { test_file: testConfig.name, timestamp: new Date().toISOString() };

    try {
        const extractDir = await extractWithOriginalTools(testConfig.source, tempDir);
        const hashResult = await calculateDirectoryHash(extractDir);

        result.extracted_files = hashResult;
        result.success = true;

        cleanup(tempDir);
        logger.success(`Generated hashes for ${testConfig.name}`);

        logger.verbose(`Files: ${hashResult.file_count}`);
        logger.verbose(`Total size: ${hashResult.total_size}`);
        logger.verbose(`Strategy: ${hashResult.strategy}`);

        return { success: true, data: result };
    } catch (error) {
        logger.error(`Extraction hash generation failed: ${error.message}`);
        result.error = error.message;
        result.success = false;
        cleanup(tempDir);
        return { success: false, data: result };
    }
}

function createResultTemplate() {
    return {
        generated_at: new Date().toISOString(),
        purpose: 'Reference hashes from original Windows tools (iz.exe + ez.exe)',
        tool: 'Original Windows tools (iz.exe + ez.exe)',
        test_files: {}
    };
}

module.exports = {
    generate,
    createResultTemplate,
    OUTPUT_PATH: config.EXTRACTION_ORIGINAL_HASHES_PATH
};
