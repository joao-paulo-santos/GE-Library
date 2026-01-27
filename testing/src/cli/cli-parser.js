/**
 * Command-line argument parsing
 * Single responsibility: Parse and validate CLI arguments
 */

class CliParser {
    constructor() {
        this.options = {};
        this.command = null;
        this.showHelp = false;
    }

    parse(args) {
        const parsed = {
            command: null,
            options: {},
            showHelp: false,
            positionalArgs: []
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            if (arg === '--help' || arg === '-h') {
                this.showHelp = true;
                parsed.showHelp = true;
                return parsed;
            } else if (arg.startsWith('--')) {
                const key = arg.substring(2);
                if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    parsed.options[key] = args[i + 1];
                    i++;
                } else {
                    parsed.options[key] = true;
                }
            } else if (arg.startsWith('-')) {
                const flags = arg.substring(1);
                for (const char of flags) {
                    parsed.options[char] = true;
                }
            } else {
                if (parsed.command === null && arg.startsWith('-') === false) {
                    parsed.command = arg;
                } else {
                    parsed.positionalArgs.push(arg);
                }
            }
        }

        this.options = parsed.options;
        this.command = parsed.command;

        return parsed;
    }

    validateOptions(command, options) {
        const errors = [];

        const validCommands = ['generate', 'test', 'test-extraction', 'test-optimization'];
        if (command && !validCommands.includes(command)) {
            errors.push(`Invalid command: ${command}`);
        }

        return errors;
    }

    getCommandHelp(command) {
        const helpText = {
            generate: {
                name: 'generate',
                description: 'Generate reference hash databases (requires iz.exe + ez.exe)',
                usage: 'node generate.js [options]',
                options: [
                    '  --ipf-path, -i <path>         Path to IPF files directory',
                    '  --output-dir, -o <path>       Output directory for hash databases',
                    '  --verbose, -v               Enable detailed output',
                    '  --help, -h                  Show this help message'
                ]
            },
            test: {
                name: 'test',
                description: 'Run all tests (extraction + optimization)',
                usage: 'node cli.js test [options]',
                options: [
                    '  --verbose, -v      Enable detailed output',
                    '  --keep              Keep extracted/optimized files for debugging (otherwise cleaned up)',
                    '  --help, -h         Show this help message'
                ]
            },
            'test-extraction': {
                name: 'test-extraction',
                description: 'Run extraction validation test',
                usage: 'node cli.js test-extraction [options]',
                options: [
                    '  --verbose, -v      Enable detailed output',
                    '  --keep              Keep extracted files for debugging (otherwise cleaned up)',
                    '  --help, -h         Show this help message'
                ]
            },
            'test-optimization': {
                name: 'test-optimization',
                description: 'Run optimization validation test',
                usage: 'node cli.js test-optimization [options]',
                options: [
                    '  --verbose, -v      Enable detailed output',
                    '  --quiet, -q        Suppress console output',
                    '  --help, -h         Show this help message'
                ]
            },
            general: {
                name: 'help',
                description: 'Show this help message',
                usage: 'node cli.js',
                options: [
                    '  --help, -h         Show this help message'
                ]
            }
        };

        const cmd = helpText[command];
        if (!cmd) {
            return `Unknown command: ${command}\nRun with --help for available commands`;
        }

        let help = `\n${cmd.name} - ${cmd.description}\n`;
        help += `Usage:\n${cmd.usage}\n\nOptions:\n`;

        for (const opt of cmd.options) {
            help += `${opt}\n`;
        }

        return help;
    }

    showGeneralHelp() {
        return `
 Granado Espada IPF Tools - Validation Framework

 Commands:
    generate             Generate reference hash databases
    test                 Run all tests (extraction + optimization)
    test-extraction       Run extraction validation test
    test-optimization    Run optimization validation test

  Global options:
    --help, -h     Show this help message

  For command-specific help, run: <command> --help

 `;
    }
}

module.exports = CliParser;
