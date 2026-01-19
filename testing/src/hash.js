/**
 * Calculate cryptographic hashes
 * Single responsibility: Pure hash calculations (no side effects)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Calculate SHA-256 hash of a file (streaming for large files)
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} - SHA-256 hash as hex string
 */
function calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

/**
 * Calculate SHA-256 hash of string content
 * @param {string} content - Content to hash
 * @returns {string} - SHA-256 hash as hex string
 */
function calculateStringHash(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Calculate hash of directory (router to appropriate strategy)
 * @param {string} dirPath - Directory path
 * @param {Object} strategy - Strategy instance with calculateHash method
 * @returns {Promise<Object>} - Directory hash information
 */
async function calculateDirectoryHash(dirPath, strategy) {
    const hashCalculator = await strategy.calculateHash(dirPath);
    return hashCalculator;
}

/**
 * Calculate full hash of all files in directory
 * @param {string} dirPath - Directory path
 * @param {Array} files - List of file paths
 * @returns {Promise<Object>} - Full hash information
 */
async function calculateFullHash(dirPath, files) {
    const filesData = {};
    let totalSize = 0;

    for (const filePath of files) {
        try {
            const hash = await calculateFileHash(filePath);
            const stat = fs.statSync(filePath);
            const relPath = path.basename(filePath);

            filesData[relPath] = {
                hash: hash,
                size: stat.size
            };
            totalSize += stat.size;
        } catch (error) {
            throw new Error(`Failed to hash ${filePath}: ${error.message}`);
        }
    }

    const manifestContent = JSON.stringify(filesData, Object.keys(filesData).sort());
    const manifestHash = calculateStringHash(manifestContent);

    return {
        strategy: 'full',
        file_count: Object.keys(filesData).length,
        total_size: totalSize,
        files: filesData,
        manifest_hash: manifestHash
    };
}

/**
 * Calculate sampling hash of selected files
 * @param {string} dirPath - Directory path
 * @param {Array} files - List of all file paths
 * @param {Array} sampledFiles - Selected file paths to hash
 * @returns {Promise<Object>} - Sampling hash information
 */
async function calculateSamplingHash(dirPath, files, sampledFiles) {
    const filesData = {};
    let totalSize = 0;

    for (const filePath of sampledFiles) {
        try {
            const hash = await calculateFileHash(filePath);
            const stat = fs.statSync(filePath);
            const relPath = path.basename(filePath);

            filesData[relPath] = {
                hash: hash,
                size: stat.size
            };
            totalSize += stat.size;
        } catch (error) {
            throw new Error(`Failed to hash ${filePath}: ${error.message}`);
        }
    }

    const sampleContent = JSON.stringify(filesData, Object.keys(filesData).sort());
    const sampleHash = calculateStringHash(sampleContent);

    const avgFileSize = totalSize / sampledFiles.length;
    const estimatedTotalSize = Math.round(avgFileSize * files.length);

    return {
        strategy: 'sampling',
        file_count: files.length,
        total_size: estimatedTotalSize,
        sampled_files: filesData,
        sample_hash: sampleHash
    };
}

module.exports = {
    calculateFileHash,
    calculateStringHash,
    calculateDirectoryHash,
    calculateFullHash,
    calculateSamplingHash
};
