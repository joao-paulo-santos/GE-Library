/**
 * Command dispatch
 * Single responsibility: Entry point and command routing
 */

const CliParser = require('./cli-parser');
const Logger = require('../logger');
const config = require('../config');

const logger = new Logger(config.LOG_LEVEL, config.LOG_SINK, config.LOG_FILE);

class CliRunner {
    constructor() {
        this.commands = {
            validate: require('./commands/validate.js'),
            compare: require('./commands/compare.js'),
            generate: require('./commands/generate.js'),
            test: require('./commands/test.js'),
            extract: require('./commands/extract.js')
        };
    }

    /**
     * Run CLI with given arguments
     * @param {Array<string>} args - CLI arguments
     * @returns {Promise<number>} - Exit code (0 = success, 1 = failure)
     */
    async run(args) {
        const parser = new CliParser();
        const parsed = parser.parse(args);

        if (parsed.showHelp) {
            if (parsed.command && this.commands[parsed.command]?.showHelp) {
                console.log(this.commands[parsed.command].showHelp());
            } else {
                console.log(parser.showGeneralHelp());
            }
            return 0;
        }

        if (!parsed.command) {
            logger.error('No command specified');
            console.log(parser.showGeneralHelp());
            return 1;
        }

        const commandHandler = this.commands[parsed.command];
        if (!commandHandler) {
            logger.error(`Unknown command: ${parsed.command}`);
            console.log(parser.showGeneralHelp());
            return 1;
        }

        try {
            const exitCode = await commandHandler.execute(parsed);
            return exitCode;
        } catch (error) {
            logger.error(`Command failed: ${error.message}`);
            return 1;
        }
    }

    /**
     * Handle errors
     * @param {Error} error - Error object
     * @returns {number} - Exit code
     */
    handleError(error) {
        logger.error(`Unexpected error: ${error.message}`);

        if (error.stack) {
            logger.debug(error.stack);
        }

        return 1;
    }
}

module.exports = CliRunner;
