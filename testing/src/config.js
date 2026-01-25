/**
 * Centralized configuration
 * Single responsibility: Single source of truth for all settings
 */

const path = require('path');

// Calculate project root dynamically from this file's location
// File is at: testing/src/config.js
// Project root is: ge-library/ (two levels up)
const PROJECT_ROOT = path.resolve(__dirname, '../..');

module.exports = {
    // Paths (all relative to PROJECT_ROOT)
    PROJECT_ROOT,
    TEST_FILES_DIR: path.join(PROJECT_ROOT, 'testing/test_files'),
    TEST_HASHES_DIR: path.join(PROJECT_ROOT, 'testing/test_hashes'),
    PLATFORM_TARGET: 'linux-amd64',  // Set explicitly by developer (no auto-detection)
    get EXTRACTOR_PATH() {
        const ext = this.PLATFORM_TARGET.startsWith('windows') ? '.exe' : '';
        return path.join(PROJECT_ROOT, `releases/ge-library/${this.PLATFORM_TARGET}/ipf-extractor${ext}`);
    },
    get OPTIMIZER_PATH() {
        const ext = this.PLATFORM_TARGET.startsWith('windows') ? '.exe' : '';
        return path.join(PROJECT_ROOT, `releases/ge-library/${this.PLATFORM_TARGET}/ipf-optimizer${ext}`);
    },
    ORIGINAL_TOOLS_DIR: path.join(PROJECT_ROOT, 'releases/original/bin'),
    
    // Hash databases (organized by tool type)
    EXTRACTION_ORIGINAL_HASHES_PATH: path.join(PROJECT_ROOT, 'testing/test_hashes/tools/extraction/original_hashes.json'),
    EXTRACTION_OUR_HASHES_PATH: path.join(PROJECT_ROOT, 'testing/test_hashes/tools/extraction/our_hashes.json'),
    OPTIMIZATION_ORIGINAL_HASHES_PATH: path.join(PROJECT_ROOT, 'testing/test_hashes/tools/optimization/original_hashes.json'),
    OPTIMIZATION_OUR_HASHES_PATH: path.join(PROJECT_ROOT, 'testing/test_hashes/tools/optimization/our_hashes.json'),

    // Hashing strategies
    HASH_STRATEGY_THRESHOLD: 100,  // <=100 files = full, >100 = sampling
    SAMPLING_CONFIG: {
        SECTION_COUNT: 3,              // Beginning, middle, end
        SAMPLES_PER_SECTION: 15,        // 15 files per section = 45 total
        MIN_SAMPLES: 30,               // Fallback if fewer files
    },

    // Validation settings
    SIZE_TOLERANCE_PERCENT: 0.1,  // Allow 0.1% size difference
    HASH_ALGORITHM: 'sha256',

    // Execution timeouts
    EXECUTION_TIMEOUT: 600000,      // 10 minutes
    EXTRACTOR_TIMEOUT: 600000,

    // Test file configurations
    TEST_FILES: {
        small: {
            name: 'ai.ipf',
            source: path.join(PROJECT_ROOT, 'testing/test_files/ai.ipf'),
            output: path.join(PROJECT_ROOT, 'testing/reference_our/small_our'),
            type: 'extraction'
        },
        medium: {
            name: 'item_texture.ipf',
            source: path.join(PROJECT_ROOT, 'testing/test_files/item_texture.ipf'),
            output: path.join(PROJECT_ROOT, 'testing/reference_our/medium_our'),
            type: 'extraction'
        },
        large: {
            name: 'ui.ipf',
            source: path.join(PROJECT_ROOT, 'testing/test_files/ui.ipf'),
            output: path.join(PROJECT_ROOT, 'testing/reference_our/large_our'),
            type: 'extraction'
        },
        ui_optimized: {
            name: 'ui_optimized.ipf',
            source: path.join(PROJECT_ROOT, 'testing/test_files/ui_optimized.ipf'),
            type: 'optimization',
            original_source: path.join(PROJECT_ROOT, 'testing/test_files/ui.ipf')
        }
    },

    // Logging configuration
    LOG_LEVEL: 'info',  // debug, info, warn, error
    LOG_SINK: 'console', // console, file, both
    LOG_FILE: path.join(PROJECT_ROOT, 'testing/validation.log')
};
