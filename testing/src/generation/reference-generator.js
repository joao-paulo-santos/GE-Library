/**
 * Generate reference hash databases
 * Single responsibility: Orchestrate reference hash generation
 */

const path = require('path');
const { executeOriginalTool } = require('../executor');
const { calculateDirectoryHash } = require('../hashing/hash-calculator');
const { removeDir, ensureDir, writeJson, readJson } = require('../filesystem');
const { scanDirectory } = require('../analysis/directory-analyzer');
const HashDatabase = require('./hash-database');
const config = require('../config');

class ReferenceGenerator {
    constructor(logger) {
        this.logger = logger;
        this.db = new HashDatabase(config.EXTRACTION_ORIGINAL_HASHES_PATH);
    }

    /**
     * Generate reference hashes for all test files
     * @param {Object} testFileConfigs - Test file configurations
     * @param {string} outputDir - Output directory for hash database
     * @returns {Promise<Object>} - Generated hash database
     */
    async generate(testFileConfigs, outputDir) {
        this.logger.info('=== Starting Reference Hash Generation ===');

        ensureDir(outputDir);

        this.db.db = {
            tool: 'Original tools (iz.exe + ez.exe)',
            purpose: 'Reference hashes for IPF extraction validation',
            generated_at: new Date().toISOString(),
            test_files: {}
        };

        let successCount = 0;
        let totalCount = 0;

        for (const [fileKey, fileConfig] of Object.entries(testFileConfigs)) {
            this.logger.info(`Processing ${fileConfig.name} (${fileKey})...`);
            totalCount++;

            try {
                const result = await this.processTestFile(fileKey, fileConfig);

                if (result && !result.error) {
                    this.db.addTestFile(fileKey, result);
                    successCount++;
                    this.logger.info(`✓ Generated reference hashes for ${fileKey}`);
                } else {
                    this.logger.error(`✗ Failed to process ${fileKey}: ${result.error || 'Unknown error'}`);
                    this.db.addTestFile(fileKey, {
                        error: result.error || 'Unknown error',
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                this.logger.error(`✗ Exception processing ${fileKey}: ${error.message}`);
                this.db.addTestFile(fileKey, {
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        await this.db.save();
        await this.db.validate();

        this.logger.info(`\n=== Generation Complete ===`);
        this.logger.info(`Total files: ${totalCount}`);
        this.logger.info(`Successful: ${successCount}`);
        this.logger.info(`Failed: ${totalCount - successCount}`);
        this.logger.info(`Database saved to: ${this.db.dbPath}`);

        return this.db.db;
    }

    /**
     * Process single test file through iz.exe + ez.exe pipeline
     * @param {string} fileKey - Test file key
     * @param {Object} fileConfig - Test file configuration
     * @returns {Promise<Object>} - Test file hash data
     */
    async processTestFile(fileKey, fileConfig) {
        const ipfSource = fileConfig.source;

        if (!require('fs').existsSync(ipfSource)) {
            return {
                error: `IPF file not found: ${ipfSource}`
            };
        }

        const results = {
            test_file: fileConfig.name,
            ipf_size: 0,
            ipf_hash: null,
            timestamp: new Date().toISOString()
        };

        const { calculateFileHash } = require('../hash');
        const fs = require('fs');

        results.ipf_size = fs.statSync(ipfSource).size;
        results.ipf_hash = await calculateFileHash(ipfSource);

        const tempDir = path.join(config.TEST_HASHES_DIR, `temp_${fileKey}`);
        removeDir(tempDir);
        ensureDir(tempDir);

        try {
            const izResult = await this.runIzExe(ipfSource, tempDir);
            if (!izResult.success || !izResult.zipPath) {
                return {
                    ...results,
                    error: `iz.exe failed: ${izResult.error}`
                };
            }

            results.iz_exe = {
                success: true,
                output_zip_hash: izResult.zipHash,
                processing_time_ms: izResult.time,
                output_size: izResult.zipSize
            };

            const ezResult = await this.runEzExe(izResult.zipPath, tempDir);
            if (!ezResult.success || !ezResult.extractDir) {
                return {
                    ...results,
                    error: `ez.exe failed: ${ezResult.error}`
                };
            }

            results.ez_exe = {
                success: true,
                processing_time_ms: ezResult.time,
                directory_hash: await ezResult.directoryHash
            };

            if (ezResult.extractDir) {
                removeDir(ezResult.extractDir);
            }

            if (izResult.zipPath && require('fs').existsSync(izResult.zipPath)) {
                fs.unlinkSync(izResult.zipPath);
            }

            return results;
        } finally {
            removeDir(tempDir);
        }
    }

    /**
     * Run iz.exe to convert IPF to password-protected ZIP
     * @param {string} ipfPath - Path to IPF file
     * @param {string} workDir - Working directory
     * @returns {Promise<Object>} - Execution result
     */
    async runIzExe(ipfPath, workDir) {
        this.logger.debug('Running iz.exe...');

        const startTime = Date.now();
        const result = await executeOriginalTool('iz.exe', [path.basename(ipfPath)], workDir);

        const expectedZip = path.join(workDir, `${path.parse(ipfPath).name}.zip`);

        if (!result.success) {
            return {
                success: false,
                error: result.error,
                zipPath: null,
                zipHash: null,
                time: 0,
                zipSize: 0
            };
        }

        if (!require('fs').existsSync(expectedZip)) {
            return {
                success: false,
                error: `iz.exe did not create expected ZIP: ${expectedZip}`,
                zipPath: null,
                zipHash: null,
                time: 0,
                zipSize: 0
            };
        }

        const { calculateFileHash } = require('../hash');
        const zipHash = await calculateFileHash(expectedZip);
        const zipSize = require('fs').statSync(expectedZip).size;
        const time = Date.now() - startTime;

        return {
            success: true,
            zipPath: expectedZip,
            zipHash: zipHash,
            zipSize: zipSize,
            time: time
        };
    }

    /**
     * Run ez.exe to extract password-protected ZIP
     * @param {string} zipPath - Path to ZIP file
     * @param {string} workDir - Working directory
     * @returns {Promise<Object>} - Execution result
     */
    async runEzExe(zipPath, workDir) {
        this.logger.debug('Running ez.exe...');

        const startTime = Date.now();
        const result = await executeOriginalTool('ez.exe', [path.basename(zipPath)], workDir);

        const zipName = path.parse(zipPath).name;
        const expectedExtractDir = path.join(workDir, path.parse(zipName).name);

        if (!result.success) {
            return {
                success: false,
                error: result.error,
                extractDir: null,
                directoryHash: null,
                time: 0
            };
        }

        if (!require('fs').existsSync(expectedExtractDir)) {
            return {
                success: false,
                error: `ez.exe did not create extraction directory: ${expectedExtractDir}`,
                extractDir: null,
                directoryHash: null,
                time: 0
            };
        }

        const directoryHash = await calculateDirectoryHash(expectedExtractDir);
        const time = Date.now() - startTime;

        return {
            success: true,
            extractDir: expectedExtractDir,
            directoryHash: directoryHash,
            time: time
        };
    }
}

module.exports = ReferenceGenerator;
