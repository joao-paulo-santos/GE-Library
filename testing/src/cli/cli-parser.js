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

        const validCommands = ['validate', 'compare', 'generate', 'test', 'extract'];
        if (command && !validCommands.includes(command)) {
            errors.push(`Invalid command: ${command}`);
        }

        return errors;
    }

    getCommandHelp(command) {
        const helpText = {
            validate: {
                name: 'validate',
                description: 'Validate IPF extraction output',
                usage: 'node validate.js [options]',
                options: [
                    '  --verbose, -v       Enable detailed output',
                    '  --quiet, -q         Suppress console output',
                    '  --help, -h          Show this help message'
                ]
            },
            compare: {
                name: 'compare',
                description: 'Compare pre-existing outputs with reference hashes',
                usage: 'node compare.js [options]',
                options: [
                    '  --output, -o <path>         Path to output directory or file',
                    '  --test-key, -k <key>           Test file key (e.g., small, medium, large)',
                    '  --output-map, -m <json>      JSON mapping of test keys to outputs',
                    '  --reference, -r <path>         Path to reference hashes file',
                    '  --report-json <path>          Save report to JSON file',
                    '  --quiet, -q                  Suppress console output',
                    '  --verbose, -v               Enable detailed output',
                    '  --help, -h                  Show this help message'
                ]
            },
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
            extract: {
                name: 'extract',
                description: 'Run IPF extractor on a file',
                usage: 'node extract.js <ipf_file> <output_dir>',
                options: [
                    '  <ipf_file>                     Path to IPF file',
                    '  <output_dir>                  Output directory',
                    '  --help, -h                      Show this help message'
                ]
            },
            test: {
                name: 'test',
                description: 'Run complete extraction and validation test',
                usage: 'node cli.js test [options]',
                options: [
                    '  --verbose, -v      Enable detailed output',
                    '  --keep              Keep extracted files for debugging (otherwise cleaned up)',
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
    validate         Validate IPF extraction output
    compare          Compare pre-existing outputs with reference hashes
    generate         Generate reference hash databases
    test             Run complete extraction and validation test
    extract          Run IPF extractor

  Global options:
    --help, -h     Show this help message

  For command-specific help, run: <command> --help

  For command-specific help, run: <command> --help
 `;
    }
}

module.exports = CliParser;
