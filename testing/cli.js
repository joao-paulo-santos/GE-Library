/**
 * Main CLI entry point
 * Single responsibility: Entry point for the CLI tool
 */

const path = require('path');
const CliRunner = require(path.resolve(__dirname, './src/cli/cli-runner'));

async function main() {
    const args = process.argv.slice(2);
    
    try {
        const runner = new CliRunner();
        const exitCode = await runner.run(args);
        process.exit(exitCode);
    } catch (error) {
        console.error('Fatal error:', error.message);
        process.exit(1);
    }
}

main();
