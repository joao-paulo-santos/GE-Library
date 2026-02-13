const { executeCommand } = require('../executor');
const { calculateDirectoryHash } = require('../hashing/hash-calculator');
const { getFileInfo, fileExists, ensureDir, cleanup } = require('../filesystem');
const path = require('path');
const Logger = require('../logger');
const config = require('../config');
const { countIPFFiles } = require('../count-ipf-files');
const { formatBytes } = require('./base');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

async function generate(testConfig, testKey, options) {
    logger.info(`Generating creation hashes for ${testConfig.name}...`);
    
    const tempDir = path.join(config.TEMP_DIR, `creation_${testKey}`);
    const sourceFolder = path.join(tempDir, 'source');
    const tempZip = path.join(tempDir, 'source.zip');
    const tempIpf = path.join(tempDir, 'source.zip.ipf');
    const extractDir = path.join(tempDir, 'extracted');

    try {
        cleanup(tempDir);
        ensureDir(sourceFolder);

        logger.info(`Extracting ${path.basename(testConfig.source)} with our extractor...`);
        
        const preExtractResult = await executeCommand(
            config.EXTRACTOR_PATH,
            ['-input', testConfig.source, '-output', sourceFolder],
            config.EXECUTION_TIMEOUT
        );

        if (!preExtractResult.success) {
            throw new Error(`Pre-extraction failed: ${preExtractResult.error || preExtractResult.stderr}`);
        }

        logger.debug(`Running cz.exe on source folder...`);
        const czResult = await executeCommand(
            config.CZ_BIN,
            ['source'],
            config.EXECUTION_TIMEOUT,
            { cwd: tempDir }
        );

        if (!czResult.success) {
            throw new Error(`cz.exe failed: ${czResult.error || czResult.stderr}`);
        }

        if (!fileExists(tempZip)) {
            throw new Error(`cz.exe did not create expected ZIP`);
        }

        logger.debug(`Running zi.exe on ZIP...`);
        const ziResult = await executeCommand(
            config.ZI_BIN,
            ['source.zip'],
            config.EXECUTION_TIMEOUT,
            { cwd: tempDir }
        );

        if (!ziResult.success) {
            throw new Error(`zi.exe failed: ${ziResult.error || ziResult.stderr}`);
        }

        if (!fileExists(tempIpf)) {
            throw new Error(`zi.exe did not create expected IPF`);
        }

        const ipfStats = getFileInfo(tempIpf);
        const fileCount = countIPFFiles(tempIpf);

        logger.info(`Extracting created IPF with our ipf-extractor...`);
        ensureDir(extractDir);
        
        const extractResult = await executeCommand(
            config.EXTRACTOR_PATH,
            ['-input', tempIpf, '-output', extractDir],
            config.EXECUTION_TIMEOUT
        );

        if (!extractResult.success) {
            throw new Error(`ipf-extractor failed: ${extractResult.error || extractResult.stderr}`);
        }

        const hashResult = await calculateDirectoryHash(extractDir);

        const data = {
            created_ipf: {
                source_ipf: path.basename(testConfig.source),
                size_bytes: ipfStats.size,
                file_count: fileCount
            },
            extracted_files: hashResult,
            timestamp: new Date().toISOString()
        };

        cleanup(tempDir);
        logger.success(`Creation hashes generated successfully`);
        
        logger.verbose(`Created IPF: ${formatBytes(ipfStats.size)} (${fileCount} files)`);
        logger.verbose(`Extracted: ${hashResult.file_count} files, ${formatBytes(hashResult.total_size)}`);
        logger.verbose(`Strategy: ${hashResult.strategy}`);

        return { success: true, data };
    } catch (error) {
        logger.error(`Creation hash generation failed: ${error.message}`);
        cleanup(tempDir);
        return { success: false, data: { error: error.message, timestamp: new Date().toISOString() } };
    }
}

function createResultTemplate() {
    return {
        generated_at: new Date().toISOString(),
        purpose: 'Reference hashes for IPF creation validation (extracted contents, not IPF file)',
        tool: 'Original Windows tools (cz.exe + zi.exe) + our ipf-extractor',
        test_files: {}
    };
}

module.exports = {
    generate,
    createResultTemplate,
    OUTPUT_PATH: config.CREATION_ORIGINAL_HASHES_PATH
};
