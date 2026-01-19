/**
 * Result data structure for hash comparisons
 * Single responsibility: Store and query comparison results
 */

class ComparisonResult {
    constructor(results) {
        this.strategy = results.strategy || 'unknown';
        this.file_count_match = results.file_count_match || false;
        this.total_size_match = results.total_size_match || false;
        this.size_difference_percent = results.size_difference_percent || 0;

        if (results.strategy === 'full') {
            this.manifest_hash_match = results.manifest_hash_match || false;
            this.missing_files = results.missing_files || [];
            this.extra_files = results.extra_files || [];
            this.hash_mismatches = results.hash_mismatches || [];
        } else if (results.strategy === 'sampling') {
            this.sample_hash_match = results.sample_hash_match || false;
            this.sample_mismatches = results.sample_mismatches || [];
        }

        this.perfect_match = results.perfect_match || false;
    }

    /**
     * Check if comparison is perfect match
     * @returns {boolean} - True if all checks passed
     */
    isPerfectMatch() {
        return this.perfect_match;
    }

    /**
     * Get list of differences
     * @returns {Array<Object>} - Mismatches
     */
    getDifferences() {
        if (this.strategy === 'full') {
            return [
                ...this.missing_files,
                ...this.extra_files,
                ...this.hash_mismatches
            ];
        } else if (this.strategy === 'sampling') {
            return this.sample_mismatches;
        }

        return [];
    }

    /**
     * Get comparison statistics
     * @returns {Object} - Statistics object
     */
    getStatistics() {
        const stats = {
            perfect_match: this.perfect_match,
            file_count_match: this.file_count_match,
            total_size_match: this.total_size_match,
            size_difference_percent: this.size_difference_percent
        };

        if (this.strategy === 'full') {
            stats.manifest_hash_match = this.manifest_hash_match;
            stats.missing_files_count = this.missing_files.length;
            stats.extra_files_count = this.extra_files.length;
            stats.hash_mismatches_count = this.hash_mismatches.length;
        } else if (this.strategy === 'sampling') {
            stats.sample_hash_match = this.sample_hash_match;
            stats.sample_mismatches_count = this.sample_mismatches.length;
        }

        return stats;
    }

    /**
     * Convert to JSON format
     * @returns {Object} - Serialized result
     */
    toJSON() {
        return this.getStatistics();
    }

    /**
     * Get human-readable summary
     * @returns {string} - Summary string
     */
    getSummary() {
        if (this.perfect_match) {
            return 'Perfect match: All checks passed';
        }

        const issues = [];
        const stats = this.getStatistics();

        if (!stats.file_count_match) {
            issues.push(`File count mismatch: ${this.strategy}`);
        }
        if (!stats.total_size_match) {
            issues.push(`Total size mismatch: ${stats.size_difference_percent.toFixed(2)}%`);
        }

        if (this.strategy === 'full') {
            if (!stats.manifest_hash_match) {
                issues.push('Manifest hash mismatch');
            }
            if (stats.missing_files_count > 0) {
                issues.push(`${stats.missing_files_count} missing files`);
            }
            if (stats.extra_files_count > 0) {
                issues.push(`${stats.extra_files_count} extra files`);
            }
            if (stats.hash_mismatches_count > 0) {
                issues.push(`${stats.hash_mismatches_count} hash mismatches`);
            }
        } else if (this.strategy === 'sampling') {
            if (!stats.sample_hash_match) {
                issues.push('Sample hash mismatch');
            }
            if (stats.sample_mismatches_count > 0) {
                issues.push(`${stats.sample_mismatches_count} sample mismatches`);
            }
        }

        return issues.join(', ');
    }
}

module.exports = ComparisonResult;
