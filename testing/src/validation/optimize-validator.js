/**
 * Validate optimization output
 * Single responsibility: Optimization validation logic
 */

const { calculateFileHash } = require('../hash');
const { fileExists, getFileInfo } = require('../filesystem');
const BaseValidator = require('./base-validator');

class OptimizeValidator extends BaseValidator {
    async performValidation(optimizedPath, testFileKey, testFileData) {
        this.logger.info(`Validating ${testFileKey} optimization...`);

        if (!fileExists(optimizedPath)) {
            return {
                status: 'validation_error',
                error: `Optimized file not found: ${optimizedPath}`,
                tool_type: 'optimization',
                test_file: testFileKey,
                perfect_match: false
            };
        }

        try {
            const hashMatch = await this.validateIPFHash(optimizedPath, testFileData);
            const sizeMatch = await this.validateSizeReduction(optimizedPath, testFileData);

            return {
                status: 'validation_complete',
                tool_type: 'optimization',
                test_file: testFileKey,
                perfect_match: hashMatch && sizeMatch,
                hash_match: hashMatch,
                size_match: sizeMatch
            };
        } catch (error) {
            return {
                status: 'validation_error',
                error: error.message,
                tool_type: 'optimization',
                test_file: testFileKey,
                perfect_match: false
            };
        }
    }

    async validateIPFHash(optimizedPath, testFileData) {
        this.logger.debug('Validating optimized IPF hash...');

        const { optimized } = testFileData;
        const ourHash = await calculateFileHash(optimizedPath);

        const match = ourHash === optimized.sha256;

        this.logger.debug(`Reference hash: ${optimized.sha256}`);
        this.logger.debug(`Our hash:      ${ourHash}`);
        this.logger.debug(`Hash match: ${match}`);

        return match;
    }

    async validateSizeReduction(optimizedPath, testFileData) {
        this.logger.debug('Validating size reduction...');

        const { original, reduction } = testFileData;
        const ourStats = getFileInfo(optimizedPath);

        if (!ourStats) {
            return false;
        }

        const expectedOptimizedSize = original.size_bytes - reduction.size_reduction_bytes;
        const ourSize = ourStats.size;

        const percentDifference = Math.abs((ourSize - expectedOptimizedSize) / expectedOptimizedSize * 100);
        const match = percentDifference < 0.1;

        this.logger.debug(`Expected optimized size: ${expectedOptimizedSize} bytes`);
        this.logger.debug(`Our optimized size:      ${ourSize} bytes`);
        this.logger.debug(`Size match: ${match} (${percentDifference.toFixed(4)}% difference)`);

        return match;
    }
}

module.exports = OptimizeValidator;
