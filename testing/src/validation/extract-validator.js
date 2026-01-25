/**
 * Validate IPF extraction output
 * Single responsibility: Extraction validation logic
 */

const { calculateDirectoryHash } = require('../hashing/hash-calculator');
const BaseValidator = require('./base-validator');

class ExtractValidator extends BaseValidator {
    async performValidation(outputDir, testFileKey, testFileData) {
        const referenceData = testFileData.extracted_files;

        this.logger.info(`Validating ${testFileKey} extraction...`);

        try {
            const ourOutput = await calculateDirectoryHash(outputDir);
            const { compareOutputs } = require('../comparison/hash-comparator');
            const comparison = await compareOutputs(ourOutput, referenceData);

            const result = {
                status: 'validation_complete',
                tool_type: 'extraction',
                test_file: testFileKey,
                ...comparison.toJSON()
            };

            if (comparison.isPerfectMatch()) {
                this.logger.info(`✓ ${testFileKey} validation passed`);
            } else {
                this.logger.warn(`✗ ${testFileKey} validation failed`);
                this.logger.debug(`Issues: ${comparison.getSummary()}`);
            }

            return result;
        } catch (error) {
            return {
                status: 'validation_error',
                error: error.message,
                tool_type: 'extraction',
                test_file: testFileKey
            };
        }
    }
}

module.exports = ExtractValidator;
