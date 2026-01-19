/**
 * Representative sampling hashing strategy
 * Single responsibility: Hash selected files (beginning/middle/end)
 */

const { calculateFileHash, calculateStringHash } = require('../../hash');
const fs = require('fs');
const path = require('path');

class SamplingStrategy {
    constructor(config) {
        this.name = 'sampling';
        this.config = config || {};
        this.SECTION_COUNT = config.SECTION_COUNT || 3;
        this.SAMPLES_PER_SECTION = config.SAMPLES_PER_SECTION || 15;
        this.MIN_SAMPLES = config.MIN_SAMPLES || 30;
    }

    /**
     * Hash directory using sampling strategy
     * @param {string} dirPath - Directory path
     * @returns {Promise<Object>} - Sampling hash information
     */
    async calculateHash(dirPath) {
        const { scanDirectory } = require('../../filesystem');
        const allFiles = scanDirectory(dirPath);
        const sampledFiles = this.sampleFiles(allFiles);

        const filesData = {};
        let totalSize = 0;

        for (const filePath of sampledFiles) {
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

        const sampleContent = JSON.stringify(filesData, Object.keys(filesData).sort());
        const sampleHash = calculateStringHash(sampleContent);

        const avgFileSize = totalSize / sampledFiles.length;
        const estimatedTotalSize = Math.round(avgFileSize * allFiles.length);

        return {
            strategy: this.name,
            file_count: allFiles.length,
            total_size: estimatedTotalSize,
            sampled_files: filesData,
            sample_hash: sampleHash
        };
    }

    /**
     * Select representative files from beginning/middle/end
     * @param {Array<string>} files - All file paths
     * @returns {Array<string>} - Selected file paths
     */
    sampleFiles(files) {
        if (files.length === 0) {
            return [];
        }

        const samples = [];
        const sectionCount = Math.min(this.SECTION_COUNT, files.length);
        const samplesPerSection = this.SAMPLES_PER_SECTION;
        const sectionSize = Math.floor(files.length / sectionCount);

        for (let section = 0; section < sectionCount; section++) {
            let sectionSamples;

            if (section === 0) {
                sectionSamples = this.sampleBeginning(files, samplesPerSection);
            } else if (section === sectionCount - 1) {
                sectionSamples = this.sampleEnd(files, samplesPerSection);
            } else {
                sectionSamples = this.sampleMiddle(files, samplesPerSection);
            }

            samples.push(...sectionSamples);
        }

        const finalSamples = this.removeDuplicates(samples);

        if (finalSamples.length < this.MIN_SAMPLES && files.length >= this.MIN_SAMPLES) {
            return this.fillWithEvenlySpaced(files, finalSamples);
        }

        return finalSamples;
    }

    /**
     * Sample files from beginning
     * @param {Array<string>} files - All file paths
     * @param {number} count - Number to sample
     * @returns {Array<string>} - Beginning files
     */
    sampleBeginning(files, count) {
        return files.slice(0, Math.min(count, files.length));
    }

    /**
     * Sample files from middle
     * @param {Array<string>} files - All file paths
     * @param {number} count - Number to sample
     * @returns {Array<string>} - Middle files
     */
    sampleMiddle(files, count) {
        const middleIndex = Math.floor(files.length / 2);
        const startOffset = Math.max(0, middleIndex - Math.floor(count / 2));
        const endOffset = Math.min(files.length, startOffset + count);

        return files.slice(startOffset, endOffset);
    }

    /**
     * Sample files from end
     * @param {Array<string>} files - All file paths
     * @param {number} count - Number to sample
     * @returns {Array<string>} - End files
     */
    sampleEnd(files, count) {
        const startOffset = Math.max(0, files.length - count);
        return files.slice(startOffset);
    }

    /**
     * Remove duplicate file paths
     * @param {Array<string>} files - File paths
     * @returns {Array<string>} - Unique files
     */
    removeDuplicates(files) {
        const seen = new Set();
        const unique = [];

        for (const file of files) {
            if (!seen.has(file)) {
                seen.add(file);
                unique.push(file);
            }
        }

        return unique;
    }

    /**
     * Fill samples with evenly spaced files if below minimum
     * @param {Array<string>} allFiles - All file paths
     * @param {Array<string>} currentSamples - Current sampled files
     * @returns {Array<string>} - Augmented samples
     */
    fillWithEvenlySpaced(allFiles, currentSamples) {
        const needed = this.MIN_SAMPLES - currentSamples.length;
        if (needed <= 0) {
            return currentSamples;
        }

        const existingSet = new Set(currentSamples);
        const additionalSamples = [];

        for (let i = 0; i < allFiles.length && additionalSamples.length < needed; i++) {
            const file = allFiles[i];
            if (!existingSet.has(file)) {
                const step = Math.floor(allFiles.length / needed);
                if (i % step === 0) {
                    additionalSamples.push(file);
                }
            }
        }

        return [...currentSamples, ...additionalSamples];
    }
}

module.exports = SamplingStrategy;
