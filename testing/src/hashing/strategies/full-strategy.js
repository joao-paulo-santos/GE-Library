/**
 * Full file-by-file hashing strategy
 * Single responsibility: Hash every file in directory
 */

const { calculateFileHash, calculateStringHash } = require('../../hash');
const fs = require('fs');
const path = require('path');

class FullStrategy {
    constructor() {
        this.name = 'full';
    }

    /**
     * Hash directory using full strategy
     * @param {string} dirPath - Directory path
     * @returns {Promise<Object>} - Full hash information
     */
    async calculateHash(dirPath) {
        const { scanDirectory } = require('../../filesystem');
        const files = scanDirectory(dirPath);

        const filesData = {};
        let totalSize = 0;

        for (const filePath of files) {
            try {
                const hash = await calculateFileHash(filePath);
                const stat = fs.statSync(filePath);
                const relPath = path.relative(dirPath, filePath);

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
            strategy: this.name,
            file_count: Object.keys(filesData).length,
            total_size: totalSize,
            files: filesData,
            manifest_hash: manifestHash
        };
    }

    /**
     * Create hash manifest from file data
     * @param {Object} files - File hash data
     * @returns {string} - Manifest JSON string
     */
    createManifest(files) {
        return JSON.stringify(files, Object.keys(files).sort());
    }

    /**
     * Calculate hash of manifest
     * @param {string} manifest - Manifest JSON string
     * @returns {string} - SHA-256 hash
     */
    calculateManifestHash(manifest) {
        return calculateStringHash(manifest);
    }
}

module.exports = FullStrategy;
