/**
 * Execute external commands safely
 * Single responsibility: Command execution with timeout and platform handling
 */

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

/**
 * Execute command with timeout
 * @param {string} command - Command to execute
 * @param {Array<string>} args - Command arguments
 * @param {number} timeout - Timeout in milliseconds
 * @param {Object} options - Additional spawn options
 * @returns {Promise<{success: boolean, stdout: string, stderr: string, error: string|null}>}
 */
async function executeCommand(command, args, timeout = 600000, options = {}) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let killed = false;

        const child = spawn(command, args, {
            stdio: 'pipe',
            ...options
        });

        const timeoutId = setTimeout(() => {
            killed = true;
            child.kill('SIGKILL');
            reject(new Error(`Command timed out after ${timeout}ms`));
        }, timeout);

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            clearTimeout(timeoutId);
            if (killed) return;

            if (code === 0) {
                resolve({
                    success: true,
                    stdout: stdout,
                    stderr: stderr,
                    error: null
                });
            } else {
                resolve({
                    success: false,
                    stdout: stdout,
                    stderr: stderr,
                    error: `Process exited with code ${code}`
                });
            }
        });

        child.on('error', (error) => {
            clearTimeout(timeoutId);
            resolve({
                success: false,
                stdout: stdout,
                stderr: stderr,
                error: error.message
            });
        });
    });
}

/**
 * Execute command via Wine (Linux/Mac)
 * @param {string} command - Windows command to execute
 * @param {Array<string>} args - Command arguments
 * @param {Object} options - Additional spawn options
 * @returns {Promise<Object>} - Execution result
 */
async function executeWineCommand(command, args, options = {}) {
    const platform = os.platform();

    if (platform === 'win32') {
        return executeCommand(command, args, options.timeout, options);
    }

    return executeCommand('wine', [command, ...args], options.timeout, options);
}

/**
 * Execute original Windows tools (iz.exe, ez.exe)
 * @param {string} toolName - Tool name (e.g., 'iz.exe', 'ez.exe')
 * @param {Array<string>} args - Tool arguments
 * @param {string} workingDir - Working directory for execution
 * @returns {Promise<Object>} - Execution result
 */
async function executeOriginalTool(toolName, args, workingDir = null) {
    const config = require('./config');
    const toolPath = path.join(config.ORIGINAL_TOOLS_DIR, toolName);

    const options = {};
    if (workingDir) {
        options.cwd = workingDir;
    }
    options.timeout = config.EXECUTION_TIMEOUT;

    return executeWineCommand(toolPath, args, options);
}

/**
 * Execute our compiled IPF extractor tool
 * @param {string} extractorPath - Path to extractor binary
 * @param {Array<string>} args - Extractor arguments
 * @returns {Promise<Object>} - Execution result
 */
async function executeOurTool(extractorPath, args) {
    const config = require('./config');

    return executeCommand(
        extractorPath,
        args,
        config.EXTRACTOR_TIMEOUT
    );
}

module.exports = {
    executeCommand,
    executeWineCommand,
    executeOriginalTool,
    executeOurTool
};
