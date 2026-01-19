/**
 * Hash database CRUD operations
 * Single responsibility: Hash database management and persistence
 */

const fs = require('fs');
const path = require('path');

class HashDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    /**
     * Load database from file
     * @returns {Promise<void>}
     */
    async load() {
        if (!fs.existsSync(this.dbPath)) {
            throw new Error('Database file not found: ' + this.dbPath);
        }

        try {
            const content = fs.readFileSync(this.dbPath, 'utf8');
            this.db = JSON.parse(content);
        } catch (error) {
            throw new Error('Failed to load database: ' + error.message);
        }
    }

    /**
     * Save database to file
     * @returns {Promise<void>}
     */
    async save(savePath = this.dbPath) {
        if (!this.db) {
            throw new Error('Database not loaded');
        }

        try {
            const dir = path.dirname(savePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const content = JSON.stringify(this.db, null, 2);
            fs.writeFileSync(savePath, content, 'utf8');
        } catch (error) {
            throw new Error('Failed to save database: ' + error.message);
        }
    }

    /**
     * Get test file data
     * @param {string} key - Test file key (e.g., 'small', 'medium')
     * @returns {Object|null} - Test file data or null
     */
    getTestFile(key) {
        if (!this.db || !this.db.test_files) {
            return null;
        }

        return this.db.test_files[key] || null;
    }

    /**
     * Add or replace test file entry
     * @param {string} key - Test file key
     * @param {Object} data - Test file data
     */
    addTestFile(key, data) {
        if (!this.db) {
            this.db = { test_files: {} };
        }

        this.db.test_files[key] = data;
    }

    /**
     * Merge another database into this one
     * @param {Object} otherDb - Other database object
     */
    merge(otherDb) {
        if (!otherDb || !otherDb.test_files) {
            return;
        }

        if (!this.db) {
            this.db = { test_files: {} };
        }

        for (const [key, data] of Object.entries(otherDb.test_files)) {
            this.db.test_files[key] = data;
        }
    }

    /**
     * Validate database structure
     * @throws {Error} - If database is invalid
     */
    validate() {
        if (!this.db) {
            throw new Error('Database not loaded');
        }

        if (!this.db.test_files) {
            throw new Error('Database missing test_files key');
        }

        if (typeof this.db.test_files !== 'object') {
            throw new Error('test_files must be an object');
        }

        const requiredKeys = ['tool', 'purpose', 'generated_at', 'test_files'];
        for (const key of requiredKeys) {
            if (!this.db[key]) {
                throw new Error('Database missing required key: ' + key);
            }
        }
    }

    /**
     * Get all test file keys
     * @returns {Array<string>} - Test file keys
     */
    getTestFileKeys() {
        if (!this.db || !this.db.test_files) {
            return [];
        }

        return Object.keys(this.db.test_files);
    }

    /**
     * Get database metadata
     * @returns {Object} - Metadata (tool, purpose, generated_at)
     */
    getMetadata() {
        if (!this.db) {
            return null;
        }

        return {
            tool: this.db.tool || null,
            purpose: this.db.purpose || null,
            generated_at: this.db.generated_at || null
        };
    }

    /**
     * Check if database has data for key
     * @param {string} key - Test file key
     * @returns {boolean} - True if key exists
     */
    hasTestFile(key) {
        return this.getTestFile(key) !== null;
    }
}

module.exports = HashDatabase;
