/**
 * Analyze directory structure
 * Single responsibility: Directory analysis and statistics
 */

const fs = require('fs');
const path = require('path');

/**
 * Analyze directory structure
 * @param {string} dirPath - Directory path
 * @returns {Promise<Object>} - Analysis results
 */
async function analyzeDirectory(dirPath) {
    const files = scanDirectory(dirPath);
    const fileCount = files.length;
    const totalSize = calculateTotalSize(files);
    const structure = buildManifest(dirPath, files);

    return {
        file_count: fileCount,
        total_size: totalSize,
        structure: structure
    };
}

/**
 * Count files recursively
 * @param {string} dirPath - Directory path
 * @returns {number} - File count
 */
function countFiles(dirPath) {
    const files = scanDirectory(dirPath);
    return files.length;
}

/**
 * Calculate total size of all files
 * @param {Array<string>} files - List of file paths
 * @returns {number} - Total size in bytes
 */
function calculateTotalSize(files) {
    let totalSize = 0;

    for (const filePath of files) {
        try {
            const stat = fs.statSync(filePath);
            totalSize += stat.size;
        } catch (error) {
            throw new Error(`Failed to stat ${filePath}: ${error.message}`);
        }
    }

    return totalSize;
}

/**
 * Build manifest of directory structure
 * @param {string} dirPath - Directory path
 * @param {Array<string>} files - List of file paths
 * @returns {Object} - Directory structure
 */
function buildManifest(dirPath, files) {
    const manifest = {};

    for (const filePath of files) {
        const relPath = path.relative(dirPath, filePath);
        const stat = fs.statSync(filePath);

        if (stat.isFile()) {
            const parts = relPath.split(path.sep);
            let current = manifest;

            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) {
                    current[parts[i]] = {};
                }
                current = current[parts[i]];
            }

            current[parts[parts.length - 1]] = {
                type: 'file',
                size: stat.size
            };
        }
    }

    return manifest;
}

/**
 * Validate directory exists, throw if not
 * @param {string} dirPath - Directory path
 * @throws {Error} - If directory doesn't exist
 */
function validateDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
    }
}

/**
 * Scan directory recursively to get all files
 * @param {string} dirPath - Directory path
 * @returns {Array<string>} - List of file paths
 */
function scanDirectory(dirPath) {
    const files = [];

    function scan(currentPath) {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
            const fullPath = path.join(currentPath, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                scan(fullPath);
            } else if (stat.isFile()) {
                files.push(fullPath);
            }
        }
    }

    scan(dirPath);
    return files;
}

module.exports = {
    analyzeDirectory,
    countFiles,
    calculateTotalSize,
    buildManifest,
    validateDirectoryExists,
    scanDirectory
};
