/**
 * Base validator class (abstract)
 * Single responsibility: Provide common validation interface and utilities
 * NOTE: Subclasses must implement performValidation() method
 */

const { fileExists } = require('../filesystem');

class BaseValidator {
    constructor(referenceHashesPath, logger) {
        if (this.constructor === BaseValidator) {
            throw new Error('BaseValidator is abstract and cannot be instantiated directly');
        }

        this.referenceHashesPath = referenceHashesPath;
        this.logger = logger;
        this.referenceHashes = null;
    }

    /**
     * Load reference hashes from file
     * @returns {Promise<void>}
     */
    async loadReferenceHashes() {
        const { readJson } = require('../filesystem');

        try {
            this.referenceHashes = await readJson(this.referenceHashesPath);
        } catch (error) {
            throw new Error(`Failed to load reference hashes: ${error.message}`);
        }
    }

    /**
     * Validate output (abstract method - must be implemented by subclasses)
     * @param {string} outputPath - Path to output
     * @param {string} testFileKey - Test file key in reference hashes
     * @returns {Promise<Object>} - Validation results
     */
    async validate(outputPath, testFileKey) {
        await this.loadReferenceHashes();

        if (!this.referenceHashes || !this.referenceHashes.test_files) {
            return {
                status: 'skipped',
                reason: 'no_reference_hashes',
                error: 'No reference hashes loaded'
            };
        }

        const testFileData = this.referenceHashes.test_files[testFileKey];
        if (!testFileData) {
            return {
                status: 'skipped',
                reason: 'no_reference_for_test_file',
                error: `No reference data for ${testFileKey}`
            };
        }

        if (!fileExists(outputPath)) {
            return {
                status: 'skipped',
                reason: 'output_not_found',
                error: `Output not found: ${outputPath}`
            };
        }

        return this.performValidation(outputPath, testFileKey, testFileData);
    }

    /**
     * Perform validation (abstract method - must be implemented by subclasses)
     * @param {string} outputPath - Path to output
     * @param {string} testFileKey - Test file key
     * @param {Object} testFileData - Test file reference data
     * @returns {Promise<Object>} - Validation results
     */
    async performValidation(outputPath, testFileKey, testFileData) {
        throw new Error('performValidation() must be implemented by subclass');
    }

    /**
     * Check file structure
     * @param {string} dirPath - Directory path
     * @param {Object} reference - Reference data
     * @returns {Promise<boolean>} - Structure is valid
     */
    async checkFileStructure(dirPath, reference) {
        const { analyzeDirectory } = require('../analysis/directory-analyzer');

        try {
            const analysis = await analyzeDirectory(dirPath);
            const expectedCount = reference.file_count || 0;

            return analysis.file_count === expectedCount;
        } catch (error) {
            this.logger.warn(`Structure check failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Create result object
     * @param {boolean} success - Validation success
     * @param {Object} details - Result details
     * @returns {Object} - Result object
     */
    createResult(success, details) {
        return {
            success,
            ...details
        };
    }
}

module.exports = BaseValidator;
