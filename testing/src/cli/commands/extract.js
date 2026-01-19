#!/usr/bin/env node

/**
 * Extract command implementation
 * Single responsibility: Run IPF extractor on a file
 */

const { executeOurTool } = require('../../executor');
const path = require('path');
const { fileExists, ensureDir } = require('../../filesystem');
const ConsoleReporter = require('../../reporting/console-reporter');
const Logger = require('../../logger');
const config = require('../../config');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);
const consoleReporter = new ConsoleReporter(logger);

async function extractSingle(options) {
    const ipfPath = options.ipfPath;
    const outputDir = options.outputDir;

    if (!ipfPath || !outputDir) {
        logger.error('Missing required arguments: <ipf_file> <output_dir>');
        consoleReporter.printError('Usage: node extract.js <ipf_file> <output_dir>');
        return 1;
    }

    if (!fileExists(ipfPath)) {
        logger.error(`IPF file not found: ${ipfPath}`);
        consoleReporter.printError(`IPF file not found: ${ipfPath}`);
        return 1;
    }

    try {
        ensureDir(outputDir);
    } catch (error) {
        logger.error(`Failed to create output directory: ${error.message}`);
        consoleReporter.printError(`Failed to create output directory: ${error.message}`);
        return 1;
    }

    consoleReporter.printInfo(`Extracting ${ipfPath} to ${outputDir}...`);

    try {
        const startTime = Date.now();
        const result = await executeOurTool(
            config.EXTRACTOR_PATH,
            ['-input', ipfPath, '-output', outputDir]
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        if (result.success) {
            consoleReporter.printSuccess(`Extraction completed successfully in ${elapsed}s`);
            return 0;
        } else {
            logger.error(`Extraction failed: ${result.error}`);
            logger.error(`stderr: ${result.stderr}`);
            consoleReporter.printError(`Extraction failed`);
            if (verbose) {
                console.log(result.stderr);
            }
            return 1;
        }
    } catch (error) {
        logger.error(`Extraction failed: ${error.message}`);
        consoleReporter.printError(`Extraction failed: ${error.message}`);
        return 1;
    }
}

async function main() {
    const CliParser = require('../cli-parser');
    const parser = new CliParser();
    const args = process.argv.slice(2);
    const options = parser.parse(args);

    if (options.showHelp) {
        console.log(`
 Granado Espada IPF Extractor

 Usage:
    node extract.js <ipf_file> <output_dir> [options]

 Arguments:
    <ipf_file>         Path to IPF file to extract
    <output_dir>       Output directory for extracted files

 Options:
    --verbose, -v      Enable detailed output
    --help, -h         Show this help message

 Examples:
    node extract.js ai.ipf extracted/ai
    node extract.js item_texture.ipf extracted/textures --verbose

 Configuration:
    Tool path: ${config.EXTRACTOR_PATH}
    Timeout: ${config.EXTRACTOR_TIMEOUT}ms
        `);
        return 0;
    }

    const ipfPath = args.positionalArgs?.[0];
    const outputDir = args.positionalArgs?.[1];

    const exitCode = await extractSingle({
        ipfPath,
        outputDir,
        verbose: options.verbose
    });

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
            console.log(`
 Granado Espada IPF Extractor

 Usage:
    node extract.js <ipf_file> <output_dir> [options]

 Arguments:
    <ipf_file>         Path to IPF file to extract
    <output_dir>       Output directory for extracted files

 Options:
    --verbose, -v      Enable detailed output
    --help, -h         Show this help message

 Examples:
    node extract.js ai.ipf extracted/ai
    node extract.js item_texture.ipf extracted/textures --verbose

 Configuration:
    Tool path: ${config.EXTRACTOR_PATH}
    Timeout: ${config.EXTRACTOR_TIMEOUT}ms
        `);
            return 0;
        }

        const ipfPath = options.positionalArgs?.[0];
        const outputDir = options.positionalArgs?.[1];

        if (!ipfPath || !outputDir) {
            logger.error('Missing required arguments: <ipf_file> <output_dir>');
            consoleReporter.printError('Usage: node extract.js <ipf_file> <output_dir>');
            return 1;
        }

        return await extractSingle({
            ipfPath,
            outputDir,
            verbose: options.verbose
        });
    },

    extractSingle,

    showHelp() {
        const CliParser = require('../cli-parser');
        const parser = new CliParser();
        return parser.getCommandHelp('extract');
    }
};
