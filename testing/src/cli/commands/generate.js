#!/usr/bin/env node

const { writeJson, cleanup } = require('../../filesystem');
const Logger = require('../../logger');
const config = require('../../config');

const extractionGenerator = require('../../generators/extraction-generator');
const optimizationGenerator = require('../../generators/optimization-generator');
const creationGenerator = require('../../generators/creation-generator');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

const generators = {
    extraction: extractionGenerator,
    optimization: optimizationGenerator,
    creation: creationGenerator
};

async function generateAll(options) {
    logger.info('=== Granado Espada IPF Reference Hash Generation ===');
    logger.info(`Source: ${config.TEST_FILES_DIR}`);

    const results = {
        extraction: extractionGenerator.createResultTemplate(),
        optimization: optimizationGenerator.createResultTemplate(),
        creation: creationGenerator.createResultTemplate()
    };

    const counts = {
        extraction: { success: 0, failed: 0 },
        optimization: { success: 0, failed: 0 },
        creation: { success: 0, failed: 0 }
    };

    for (const [key, fileConfig] of Object.entries(config.TEST_FILES)) {
        logger.info(`Processing ${fileConfig.name} (${key})...`);

        const generator = generators[fileConfig.type];
        if (!generator) {
            logger.error(`Unknown file type: ${fileConfig.type}`);
            continue;
        }

        const { success, data } = await generator.generate(fileConfig, key, options);
        results[fileConfig.type].test_files[key] = data;
        
        if (success) {
            counts[fileConfig.type].success++;
        } else {
            counts[fileConfig.type].failed++;
        }
    }

    logger.info('\n=== Saving Reference Databases ===');

    await saveResults('extraction', results.extraction, counts.extraction);
    await saveResults('optimization', results.optimization, counts.optimization);
    await saveResults('creation', results.creation, counts.creation);

    printSummary(counts);

    cleanup(config.TEMP_DIR);

    const totalFailed = Object.values(counts).reduce((sum, c) => sum + c.failed, 0);
    return totalFailed === 0 ? 0 : 1;
}

async function saveResults(type, results, count) {
    if (count.success === 0 && count.failed === 0) return;

    const generator = generators[type];
    await writeJson(generator.OUTPUT_PATH, results, 2);
    logger.success(`${type.charAt(0).toUpperCase() + type.slice(1)} hashes saved to: ${generator.OUTPUT_PATH}`);
}

function printSummary(counts) {
    logger.info('\n=== Summary ===');
    
    for (const [type, count] of Object.entries(counts)) {
        if (count.success > 0 || count.failed > 0) {
            const name = type.charAt(0).toUpperCase() + type.slice(1);
            logger.info(`${name} - Successful: ${count.success}, Failed: ${count.failed}`);
        }
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

    showHelp() {
        const CliParser = require('../cli-parser');
        const parser = new CliParser();
        return parser.getCommandHelp('generate');
    }
};
