/**
 * Compare hash objects
 * Single responsibility: Hash comparison logic
 */

const ComparisonResult = require('./comparison-result');
const config = require('../config');

/**
 * Compare hash outputs with reference
 * @param {Object} ourOutput - Our calculated hash output
 * @param {Object} referenceOutput - Reference hash output
 * @returns {Promise<ComparisonResult>} - Comparison result
 */
async function compareOutputs(ourOutput, referenceOutput) {
    const validStrategies = ['full', 'sampling'];
    const strategy = referenceOutput.strategy || 'full';

    if (!validStrategies.includes(strategy)) {
        throw new Error(`Invalid strategy: ${strategy}. Must be one of: ${validStrategies.join(', ')}`);
    }

    if (strategy === 'full') {
        return compareFull(ourOutput, referenceOutput);
    } else if (strategy === 'sampling') {
        return compareSamples(ourOutput, referenceOutput);
    }

    throw new Error(`Unknown strategy: ${strategy}`);
}

/**
 * Generic comparison logic
 * @param {string} strategy - Strategy type ('full' or 'sampling')
 * @param {Object} ourOutput - Our output
 * @param {Object} referenceOutput - Reference output
 * @param {Array} mismatchTypes - Types of mismatches to track
 * @returns {ComparisonResult} - Comparison result
 */
function compareGeneric(strategy, ourOutput, referenceOutput, mismatchTypes) {
    const fileCountMatch = ourOutput.file_count === referenceOutput.file_count;

    const sizeDiff = ourOutput.total_size - referenceOutput.total_size;
    const sizeDiffPct = Math.abs(sizeDiff) / referenceOutput.total_size * 100;
    const totalSizeMatch = sizeDiffPct < config.SIZE_TOLERANCE_PERCENT;

    const comparison = {
        strategy: strategy,
        file_count_match: fileCountMatch,
        total_size_match: totalSizeMatch,
        size_difference_percent: sizeDiffPct
    };

    for (const type of mismatchTypes) {
        comparison[type] = [];
    }

    return { comparison, sizeDiffPct, fileCountMatch, totalSizeMatch };
}

/**
 * Compare full hash outputs (file-by-file)
 * @param {Object} ourOutput - Our full hash output
 * @param {Object} referenceOutput - Reference full hash output
 * @returns {ComparisonResult} - Comparison result
 */
function compareFull(ourOutput, referenceOutput) {
    const result = compareGeneric('full', ourOutput, referenceOutput, ['manifest_hash', 'missing_files', 'extra_files', 'hash_mismatches']);
    const comparison = result.comparison;

    comparison.manifest_hash = ourOutput.manifest_hash === referenceOutput.manifest_hash;
    comparison.manifest_hash_match = comparison.manifest_hash;

    const ourFiles = ourOutput.files || {};
    const refFiles = referenceOutput.files || {};

    for (const filename of Object.keys(refFiles)) {
        if (!ourFiles[filename]) {
            comparison.missing_files.push(filename);
        }
    }

    for (const [filename, ourData] of Object.entries(ourFiles)) {
        if (!refFiles[filename]) {
            comparison.extra_files.push(filename);
        } else {
            const refData = refFiles[filename];
            if (ourData.hash !== refData.hash) {
                comparison.hash_mismatches.push({
                    file: filename,
                    our_hash: ourData.hash,
                    reference_hash: refData.hash
                });
            }
        }
    }

    const perfectMatch = (
        result.fileCountMatch &&
        result.totalSizeMatch &&
        comparison.manifest_hash_match &&
        comparison.missing_files.length === 0 &&
        comparison.extra_files.length === 0 &&
        comparison.hash_mismatches.length === 0
    );

    return new ComparisonResult({
        ...comparison,
        perfect_match: perfectMatch
    });
}

/**
 * Compare sampling hash outputs
 * @param {Object} ourOutput - Our sampling hash output
 * @param {Object} referenceOutput - Reference sampling hash output
 * @returns {ComparisonResult} - Comparison result
 */
function compareSamples(ourOutput, referenceOutput) {
    const result = compareGeneric('sampling', ourOutput, referenceOutput, ['sample_hash', 'sample_mismatches']);
    const comparison = result.comparison;

    comparison.sample_hash = ourOutput.sample_hash === referenceOutput.sample_hash;
    comparison.sample_hash_match = comparison.sample_hash;

    const ourSamples = ourOutput.sampled_files || {};
    const refSamples = referenceOutput.sampled_files || {};

    for (const [filename, ourData] of Object.entries(ourSamples)) {
        if (!refSamples[filename]) {
            comparison.sample_mismatches.push({
                file: filename,
                our_hash: ourData.hash,
                reference_hash: 'MISSING_IN_REFERENCE',
                error: 'File not in reference samples'
            });
        } else {
            const refData = refSamples[filename];
            if (ourData.hash !== refData.hash) {
                comparison.sample_mismatches.push({
                    file: filename,
                    our_hash: ourData.hash,
                    reference_hash: refData.hash
                });
            }
        }
    }

    const perfectMatch = (
        result.fileCountMatch &&
        result.totalSizeMatch &&
        comparison.sample_hash_match &&
        comparison.sample_mismatches.length === 0
    );

    return new ComparisonResult({
        ...comparison,
        perfect_match: perfectMatch
    });
}

/**
 * Detect differences between hash outputs
 * @param {Object} ourOutput - Our hash output
 * @param {Object} referenceOutput - Reference hash output
 * @returns {Object} - Differences object
 */
function detectDifferences(ourOutput, referenceOutput) {
    const result = new ComparisonResult({
        missing_files: [],
        extra_files: [],
        hash_mismatches: []
    });

    if (referenceOutput.strategy === 'full') {
        const ourFiles = ourOutput.files || {};
        const refFiles = referenceOutput.files || {};

        for (const filename of Object.keys(refFiles)) {
            if (!ourFiles[filename]) {
                result.missing_files.push(filename);
            }
        }

        for (const [filename, ourData] of Object.entries(ourFiles)) {
            if (!refFiles[filename]) {
                result.extra_files.push(filename);
            } else {
                const refData = refFiles[filename];
                if (ourData.hash !== refData.hash) {
                    result.hash_mismatches.push({
                        file: filename,
                        our_hash: ourData.hash,
                        reference_hash: refData.hash
                    });
                }
            }
        }
    }

    return result;
}

/**
 * Calculate match score (0.0-1.0)
 * @param {Object} results - Comparison results
 * @returns {number} - Score from 0.0 to 1.0
 */
function calculateMatchScore(results) {
    if (results.perfect_match) {
        return 1.0;
    }

    let score = 0.0;
    const maxScore = 5;

    if (results.file_count_match) score += 1;
    if (results.total_size_match) score += 1;

    if (results.strategy === 'full') {
        if (results.manifest_hash_match) score += 1;
        if (results.missing_files.length === 0) score += 1;
        if (results.extra_files.length === 0 && results.hash_mismatches.length === 0) score += 1;
    } else if (results.strategy === 'sampling') {
        if (results.sample_hash_match) score += 1;
        if (results.sample_mismatches.length === 0) score += 1;
    }

    return score / maxScore;
}

module.exports = {
    compareOutputs,
    compareFull,
    compareSamples,
    detectDifferences,
    calculateMatchScore
};
