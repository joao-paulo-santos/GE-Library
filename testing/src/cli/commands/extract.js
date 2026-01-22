#!/usr/bin/env node

/**
 * Extract command implementation
 * Single responsibility: Run IPF extractor on a file
 */

const { executeOurTool } = require('../../executor');
const path = require('path');
const { fileExists, ensureDir } = require('../../filesystem');
const Logger = require('../../logger');
const config = require('../../config');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

async function main() {
    const args = process.argv.slice(2);
    const ipfFile = args[0];
    const outputDir = args[1];
    const verbose = args.includes('--verbose') || args.includes('-v');

    if (!ipfFile || !outputDir) {
        logger.error('Missing required arguments: <ipf_file> <output_dir>');
        logger.error('Usage: node extract.js <ipf_file> <output_dir>');
        process.exit(1);
    }

    if (!fileExists(ipfFile)) {
        logger.error(`IPF file not found: ${ipfFile}`);
        process.exit(1);
    }

    try {
        ensureDir(outputDir);
    } catch (error) {
        logger.error(`Failed to create output directory: ${error.message}`);
        process.exit(1);
    }

    logger.info(`Extracting ${ipfFile} to ${outputDir}...`);

    try {
        const startTime = Date.now();
        const result = await executeOurTool(
            config.EXTRACTOR_PATH,
            ['-input', ipfFile, '-output', outputDir],
            config.EXECUTION_TIMEOUT
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        if (!result.success) {
            throw new Error(result.error || result.stderr || 'Unknown error');
        }

        logger.success(`Extraction completed successfully in ${elapsed}s`);
    } catch (error) {
        logger.error(`Extraction failed: ${error.message}`);
        if (verbose && result?.stderr) {
            logger.plain(result.stderr);
        }
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(err => {
        logger.error(`Fatal error: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { main };
