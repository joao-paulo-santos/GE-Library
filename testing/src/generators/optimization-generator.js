const { executeCommand } = require('../executor');
const { calculateFileHash } = require('../hash');
const { getFileInfo, copyFile, removeFile, fileExists, cleanup } = require('../filesystem');
const path = require('path');
const Logger = require('../logger');
const config = require('../config');
const { countIPFFiles } = require('../count-ipf-files');
const { formatBytes } = require('./base');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

async function generate(testConfig, testKey, options) {
    logger.info(`Generating optimization hashes for ${testConfig.name}...`);
    
    const tempDir = path.join(config.TEMP_DIR, `optimization_${testKey}`);
    const tempIpfPath = path.join(tempDir, 'source.ipf');

    try {
        cleanup(tempDir);
        
        logger.debug(`Copying ${testConfig.source} to ${tempIpfPath}`);
        copyFile(testConfig.source, tempIpfPath);

        logger.debug(`Running oz.exe on ${tempIpfPath}...`);
        const ozResult = await executeCommand(
            config.OZ_BIN,
            [path.basename(tempIpfPath)],
            config.EXECUTION_TIMEOUT,
            { cwd: tempDir }
        );

        if (!ozResult.success) {
            throw new Error(`oz.exe failed: ${ozResult.error || ozResult.stderr}`);
        }
        logger.debug(`oz.exe output: ${ozResult.stdout}`);

        const optimizedHash = await calculateFileHash(tempIpfPath);
        const optimizedStats = getFileInfo(tempIpfPath);
        const optimizedFileCount = countIPFFiles(tempIpfPath);

        const originalHash = await calculateFileHash(testConfig.source);
        const originalStats = getFileInfo(testConfig.source);
        const originalFileCount = countIPFFiles(testConfig.source);

        const sizeReductionBytes = originalStats.size - optimizedStats.size;
        const sizeReductionPercent = (sizeReductionBytes / originalStats.size) * 100;

        const data = {
            original: {
                test_file: path.basename(testConfig.source),
                size_bytes: originalStats.size,
                file_count: originalFileCount,
                sha256: originalHash
            },
            optimized: {
                test_file: `${path.basename(testConfig.source)} (optimized)`,
                size_bytes: optimizedStats.size,
                file_count: optimizedFileCount,
                sha256: optimizedHash
            },
            reduction: {
                size_reduction_bytes: sizeReductionBytes,
                size_reduction_percent: Math.round(sizeReductionPercent * 10) / 10,
                file_reduction_count: originalFileCount - optimizedFileCount
            },
            timestamp: new Date().toISOString()
        };

        cleanup(tempDir);
        logger.success(`Optimization hashes generated successfully`);
        
        logger.verbose(`Original: ${formatBytes(originalStats.size)} (${originalHash.substring(0, 8)}...)`);
        logger.verbose(`Optimized: ${formatBytes(optimizedStats.size)} (${optimizedHash.substring(0, 8)}...)`);
        logger.verbose(`Reduction: ${formatBytes(sizeReductionBytes)} (${sizeReductionPercent.toFixed(1)}%)`);

        return { success: true, data };
    } catch (error) {
        logger.error(`Optimization hash generation failed: ${error.message}`);
        cleanup(tempDir);
        return { success: false, data: { error: error.message, timestamp: new Date().toISOString() } };
    }
}

function createResultTemplate() {
    return {
        generated_at: new Date().toISOString(),
        purpose: 'Reference hashes from oz.exe optimization tool',
        tool: 'oz.exe (IPF Optimizer)',
        test_files: {}
    };
}

module.exports = {
    generate,
    createResultTemplate,
    OUTPUT_PATH: config.OPTIMIZATION_ORIGINAL_HASHES_PATH
};
