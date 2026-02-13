const path = require('path');

const PLATFORM_TARGET = 'linux-amd64';
const PLATFORM_EXT = PLATFORM_TARGET.startsWith('windows') ? '.exe' : '';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

const TEST_FILES_DIR = path.join(PROJECT_ROOT, 'testing/test_files');
const TEMP_DIR = path.join(PROJECT_ROOT, 'testing/temp');
const TEST_HASHES_DIR = path.join(PROJECT_ROOT, 'testing/test_hashes');

const RELEASES_DIR = path.join(PROJECT_ROOT, 'releases');
const OUR_RELEASES_DIR = path.join(RELEASES_DIR, `ge-library/${PLATFORM_TARGET}`);
const OUR_BINARIES_DIR = path.join(OUR_RELEASES_DIR, 'tools');
const ORIGINAL_BINARIES_DIR = path.join(PROJECT_ROOT, 'releases/original/bin');

const EZ_BIN = path.join(ORIGINAL_BINARIES_DIR, 'ez.exe');
const IZ_BIN = path.join(ORIGINAL_BINARIES_DIR, 'iz.exe');
const OZ_BIN = path.join(ORIGINAL_BINARIES_DIR, 'oz.exe');
const CZ_BIN = path.join(ORIGINAL_BINARIES_DIR, 'cz.exe');
const ZI_BIN = path.join(ORIGINAL_BINARIES_DIR, 'zi.exe');

const getOsFileName = (fileName) => `${fileName}${PLATFORM_EXT}`;

const EXTRACTOR_PATH = path.join(OUR_BINARIES_DIR, getOsFileName('ipf-extractor'));
const OPTIMIZER_PATH = path.join(OUR_BINARIES_DIR, getOsFileName('ipf-optimizer'));
const CREATOR_PATH = path.join(OUR_BINARIES_DIR, getOsFileName('ipf-creator'));

const EXTRACTION_ORIGINAL_HASHES_PATH = path.join(TEST_HASHES_DIR, 'tools/extraction/original_hashes.json');
const EXTRACTION_OUR_HASHES_PATH = path.join(TEST_HASHES_DIR, 'tools/extraction/our_hashes.json');
const OPTIMIZATION_ORIGINAL_HASHES_PATH = path.join(TEST_HASHES_DIR, 'tools/optimization/original_hashes.json');
const OPTIMIZATION_OUR_HASHES_PATH = path.join(TEST_HASHES_DIR, 'tools/optimization/our_hashes.json');
const CREATION_ORIGINAL_HASHES_PATH = path.join(TEST_HASHES_DIR, 'tools/creation/original_hashes.json');
const CREATION_OUR_HASHES_PATH = path.join(TEST_HASHES_DIR, 'tools/creation/our_hashes.json');

const TEST_FILES = {
    small: { name: 'ai.ipf', source: path.join(TEST_FILES_DIR, 'ai.ipf'), type: 'extraction' },
    medium: { name: 'item_texture.ipf', source: path.join(TEST_FILES_DIR, 'item_texture.ipf'), type: 'extraction' },
    large: { name: 'ui.ipf', source: path.join(TEST_FILES_DIR, 'ui.ipf'), type: 'extraction' },
    ui_optimization: { name: 'ui.ipf optimization', source: path.join(TEST_FILES_DIR, 'ui.ipf'), type: 'optimization' },
    ui_creation: { name: 'ui.ipf creation', source: path.join(TEST_FILES_DIR, 'ui.ipf'), type: 'creation' }
};

const HASH_STRATEGY_THRESHOLD = 100;
const SAMPLING_CONFIG = { SECTION_COUNT: 3, SAMPLES_PER_SECTION: 15, MIN_SAMPLES: 30 };
const EXECUTION_TIMEOUT = 600000;

const LOG_LEVEL = process.argv.includes('--verbose') || process.argv.includes('-v') ? 'verbose' : 'info';
const LOG_SINK = 'console';
const LOG_FILE = path.join(PROJECT_ROOT, 'testing/validation.log');

module.exports = {
    PLATFORM_TARGET, PLATFORM_EXT,
    PROJECT_ROOT, TEST_FILES_DIR, TEMP_DIR, TEST_HASHES_DIR,
    RELEASES_DIR, OUR_RELEASES_DIR, OUR_BINARIES_DIR, ORIGINAL_BINARIES_DIR,
    EZ_BIN, IZ_BIN, OZ_BIN, CZ_BIN, ZI_BIN,
    getOsFileName,
    EXTRACTOR_PATH, OPTIMIZER_PATH, CREATOR_PATH,
    EXTRACTION_ORIGINAL_HASHES_PATH, EXTRACTION_OUR_HASHES_PATH,
    OPTIMIZATION_ORIGINAL_HASHES_PATH, OPTIMIZATION_OUR_HASHES_PATH,
    CREATION_ORIGINAL_HASHES_PATH, CREATION_OUR_HASHES_PATH,
    TEST_FILES,
    HASH_STRATEGY_THRESHOLD, SAMPLING_CONFIG,
    EXECUTION_TIMEOUT,
    LOG_LEVEL, LOG_SINK, LOG_FILE
};
