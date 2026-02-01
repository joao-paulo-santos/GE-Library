/**
 * Centralized configuration
 * Single responsibility: Single source of truth for all settings
 */

const path = require('path');

const PLATFORM_TARGET = 'linux-amd64';  //no auto-detection, for now
const PLATFORM_EXT = PLATFORM_TARGET.startsWith('windows') ? '.exe' : '';

// Project root is: ge-library/ (two levels up)
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const TEST_FILES_DIR = path.join(PROJECT_ROOT, 'testing/test_files'); // Reference test files (ipf)

const OUR_REFERENCES_DIR = path.join(PROJECT_ROOT, 'testing/reference_our'); // Where we store the output of our tools while their hashes are being calculated, cleaned after
const ORIGINAL_REFERENCES_DIR = path.join(PROJECT_ROOT, 'testing/reference_original'); // Where the output from the original tools is stored, not cleaned since original tools are slow and not re-run often

// Releases and binaries
const RELEASES_DIR = path.join(PROJECT_ROOT, 'releases');
const OUR_RELEASES_DIR = path.join(RELEASES_DIR, `ge-library/${PLATFORM_TARGET}`);
const OUR_BINARIES_DIR = path.join(OUR_RELEASES_DIR, `tools`);
const ORIGINAL_BINARIES_DIR = path.join(PROJECT_ROOT, 'releases/original/bin');

// Original Binaries
const EZ_BIN = path.join(ORIGINAL_BINARIES_DIR, 'ez.exe');
const IZ_BIN = path.join(ORIGINAL_BINARIES_DIR, 'iz.exe');
const OZ_BIN = path.join(ORIGINAL_BINARIES_DIR, 'oz.exe');
const CZ_BIN = path.join(ORIGINAL_BINARIES_DIR, 'cz.exe');
const ZI_BIN = path.join(ORIGINAL_BINARIES_DIR, 'zi.exe');

// Helper functions to build paths
const getOsFileName = (fileName) => {
    return `${fileName}${PLATFORM_EXT}`;
};

// Our tool binaries
const EXTRACTOR_PATH = path.join(OUR_BINARIES_DIR, getOsFileName('ipf-extractor'));
const OPTIMIZER_PATH = path.join(OUR_BINARIES_DIR, getOsFileName('ipf-optimizer'));
const CREATOR_PATH = path.join(OUR_BINARIES_DIR, getOsFileName('ipf-creator'));

const TEST_HASHES_DIR = path.join(PROJECT_ROOT, 'testing/test_hashes'); // Calculated hashes from the output of tools executed

// Hash tables
// Extraction
const EXTRACTION_ORIGINAL_HASHES_PATH = path.join(TEST_HASHES_DIR, 'tools/extraction/original_hashes.json');
const EXTRACTION_OUR_HASHES_PATH = path.join(TEST_HASHES_DIR, 'tools/extraction/our_hashes.json');
// Optimization
const OPTIMIZATION_ORIGINAL_HASHES_PATH = path.join(TEST_HASHES_DIR, 'tools/optimization/original_hashes.json');
const OPTIMIZATION_OUR_HASHES_PATH = path.join(TEST_HASHES_DIR, 'tools/optimization/our_hashes.json');
// Creation
const CREATION_ORIGINAL_HASHES_PATH = path.join(TEST_HASHES_DIR, 'tools/creation/original_hashes.json');
const CREATION_OUR_HASHES_PATH = path.join(TEST_HASHES_DIR, 'tools/creation/our_hashes.json');

const TEST_FILES = {
    small: {
        name: 'ai.ipf',
        source: path.join(TEST_FILES_DIR, 'ai.ipf'),
        output: path.join(OUR_REFERENCES_DIR, 'small_our'),
        type: 'extraction'
    },
    medium: {
        name: 'item_texture.ipf',
        source: path.join(TEST_FILES_DIR, 'item_texture.ipf'),
        output: path.join(OUR_REFERENCES_DIR, 'medium_our'),
        type: 'extraction'
    },
    large: {
        name: 'ui.ipf',
        source: path.join(TEST_FILES_DIR, 'ui.ipf'),
        output: path.join(OUR_REFERENCES_DIR, 'large_our'),
        type: 'extraction'
    },
    ui_optimized: {
        name: 'ui_optimized.ipf',
        source: path.join(TEST_FILES_DIR, 'ui_optimized.ipf'),
        output: path.join(OUR_REFERENCES_DIR, 'ui_optimized'),
        type: 'optimization',
        original_source: path.join(TEST_FILES_DIR, 'ui.ipf')
    },
    ui_creation: {
        name: 'ui.ipf (creation test)',
        source: path.join(TEST_FILES_DIR, 'ui.ipf'),
        source_folder: path.join(TEST_FILES_DIR, 'ui_extracted'),
        type: 'creation'
    }
}

// Parameters
// Hashing strategies
const HASH_STRATEGY_THRESHOLD = 100;  // <=100 files = full, >100 = sampling
const SAMPLING_CONFIG = {
    SECTION_COUNT: 3,              // Beginning, middle, end
    SAMPLES_PER_SECTION: 15,        // 15 files per section = 45 total
    MIN_SAMPLES: 30,               // Fallback if fewer files
};

// Execution timeouts
const EXECUTION_TIMEOUT = 600000;      // 10 minutes

// Logging configuration
const LOG_LEVEL = 'info';  // debug, info, warn, error
const LOG_SINK = 'console'; // console, file, both
const LOG_FILE = path.join(PROJECT_ROOT, 'testing/validation.log');

module.exports = {
    // Platform
    PLATFORM_TARGET,
    PLATFORM_EXT,

    // Paths
    PROJECT_ROOT,
    TEST_FILES_DIR,
    OUR_REFERENCES_DIR,
    ORIGINAL_REFERENCES_DIR,
    RELEASES_DIR,
    OUR_RELEASES_DIR,
    OUR_BINARIES_DIR,
    ORIGINAL_BINARIES_DIR,
    TEST_HASHES_DIR,
    EZ_BIN,
    IZ_BIN,
    OZ_BIN,
    CZ_BIN,
    ZI_BIN,

    // Helper functions
    getOsFileName,

    // Tool binaries
    EXTRACTOR_PATH,
    OPTIMIZER_PATH,
    CREATOR_PATH,

    // Hash file paths
    EXTRACTION_ORIGINAL_HASHES_PATH,
    EXTRACTION_OUR_HASHES_PATH,
    OPTIMIZATION_ORIGINAL_HASHES_PATH,
    OPTIMIZATION_OUR_HASHES_PATH,
    CREATION_ORIGINAL_HASHES_PATH,
    CREATION_OUR_HASHES_PATH,

    // Test files
    TEST_FILES,

    // Hash strategy
    HASH_STRATEGY_THRESHOLD,
    SAMPLING_CONFIG,

    // Execution
    EXECUTION_TIMEOUT,

    // Logging
    LOG_LEVEL,
    LOG_SINK,
    LOG_FILE,
};
