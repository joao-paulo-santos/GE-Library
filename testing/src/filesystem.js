/**
 * File system operations
 * Single responsibility: FS abstraction layer
 */

const fs = require('fs');
const path = require('path');

/**
 * Create directory if it doesn't exist
 * @param {string} dirPath - Directory path
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Remove directory recursively
 * @param {string} dirPath - Directory to remove
 */
function removeDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
}

/**
 * Check if file exists
 * @param {string} filePath - File path
 * @returns {boolean} - True if file exists
 */
function fileExists(filePath) {
    return fs.existsSync(filePath);
}

/**
 * Read file content
 * @param {string} filePath - File path
 * @param {string} encoding - File encoding (default: utf8)
 * @returns {string} - File content
 */
function readFile(filePath, encoding = 'utf8') {
    return fs.readFileSync(filePath, encoding);
}

/**
 * Write content to file
 * @param {string} filePath - File path
 * @param {string} content - Content to write
 * @param {string} encoding - File encoding (default: utf8)
 */
function writeFile(filePath, content, encoding = 'utf8') {
    fs.writeFileSync(filePath, content, encoding);
}

/**
 * Read and parse JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {Object} - Parsed JSON object
 */
function readJson(filePath) {
    const content = readFile(filePath);
    return JSON.parse(content);
}

/**
 * Write object to JSON file
 * @param {string} filePath - Output file path
 * @param {Object} data - Data to write
 * @param {number} indent - JSON indentation (default: 2)
 */
function writeJson(filePath, data, indent = 2) {
    const jsonData = JSON.stringify(data, null, indent);
    writeFile(filePath, jsonData);
}

/**
 * Scan directory recursively to get all files
 * @param {string} dirPath - Directory path
 * @param {boolean} recursive - Scan subdirectories (default: true)
 * @returns {Array<string>} - List of file paths
 */
function scanDirectory(dirPath, recursive = true) {
    const files = [];

    function scan(currentPath) {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
            const fullPath = path.join(currentPath, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory() && recursive) {
                scan(fullPath);
            } else if (stat.isFile()) {
                files.push(fullPath);
            }
        }
    }

    scan(dirPath);
    return files;
}

/**
 * Get file information
 * @param {string} filePath - File path
 * @returns {Object} - File stats { size, mtime, etc }
 */
function getFileInfo(filePath) {
    return fs.statSync(filePath);
}

/**
 * Copy file
 * @param {string} src - Source path
 * @param {string} dest - Destination path
 */
function copyFile(src, dest) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
}

/**
 * Move file
 * @param {string} src - Source path
 * @param {string} dest - Destination path
 */
function moveFile(src, dest) {
    ensureDir(path.dirname(dest));
    fs.renameSync(src, dest);
}

module.exports = {
    ensureDir,
    removeDir,
    fileExists,
    readFile,
    writeFile,
    readJson,
    writeJson,
    scanDirectory,
    getFileInfo,
    copyFile,
    moveFile
};
