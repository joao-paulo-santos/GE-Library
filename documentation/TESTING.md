# Testing and Validation

This document covers testing procedures to validate our Granado Espada Tool Library implementations against original tools.

## Current Project Status

Our project aims to recreate the complete getools.bat tool suite. Currently, we've completed IPF extraction and are working on the remaining tools: IPF creation, optimization, IES conversion, and folder management.

## Testing Framework

We use a modular JavaScript-based testing framework to validate our implementations against original tools. The framework is located in `testing/` directory and uses hash-based comparison to ensure 100% compatibility.

### Framework Architecture

The testing framework follows a modular architecture with clear separation of concerns:

```
testing/
├── src/
│   ├── infrastructure/           # Core utilities (no business logic)
│   │   ├── hash.js            # Pure hash functions
│   │   ├── filesystem.js      # File operations
│   │   ├── executor.js        # Command execution
│   │   ├── logger.js          # Configurable logging
│   │   └── config.js          # Configuration
│   ├── business/              # Business logic
│   │   ├── analysis/          # Directory analysis
│   │   ├── hashing/           # Hash strategies
│   │   ├── comparison/        # Hash comparison
│   │   └── validation/        # Tool validators
│   ├── generation/            # Reference generation
│   │   ├── hash-database.js   # Hash database CRUD
│   │   └── reference-generator.js  # Generate reference hashes
│   └── presentation/          # User interface
│       ├── reporting/         # Output formatting
│       └── cli/              # Command-line interface
├── test_files/               # IPF test files
├── test_hashes/              # Reference hash databases
├── package.json              # npm configuration
├── cli.js                   # Main entry point
├── README.md                # Testing framework documentation
└── architecture.md          # Technical architecture
```

For detailed technical documentation, see [testing/README.md](../testing/README.md) and [testing/architecture.md](../testing/architecture.md).

## IPF Extraction Testing (Completed)

### Hash-Based Validation Framework

We use a hash-based testing system to validate our implementations against original tools without distributing copyrighted IPF files.

#### Reference Test Files

We validate against three test files from Granado Espada Classique:

| Name      | Size   | Files | Strategy |
|-----------|--------|-------|----------|
| ai.ipf    | 4.3K   | 4     | Full hash |
| item_texture.ipf | 191MB | 3,063 | Sampling |
| ui.ipf    | 877MB  | 11,567 | Sampling |

### For Users - Validate Compiled Builds

The testing framework provides npm scripts for easy validation:

```bash
cd testing

# Run full test suite (extract all test files and validate)
npm test

# Validate extraction output
npm run validate

# Validate with verbose output
npm run validate:verbose

# Run extractor only
npm run extract -- test_files/ai.ipf output_dir
```

All commands support `--help` flag for usage information.

### CI/CD Integration

The framework is designed for CI/CD pipelines:

```bash
# Silent mode for automated pipelines
npm run validate --quiet

# Non-zero exit code on any failure (exit 1 for failures, 0 for success)
npm run test
```

### For Maintainers - Generate Reference Hashes

To regenerate reference hashes (requires original Windows tools):

```bash
cd testing

# Generate reference hashes from original tool extractions
npm run generate

# This runs iz.exe + ez.exe on all test files and saves:
# - testing/test_hashes/tools/extraction/original_hashes.json (hash database)
# - testing/reference_original/ (extracted files)
```

Platform Requirements:
- **Windows**: Native execution of iz.exe and ez.exe tools
- **Linux/Mac**: Wine installed and configured for Windows tool execution

## Future Tool Testing (In Progress)

### Upcoming Tools to Test

- **IPF Creation** (`cz.exe` + `zi.exe` replication)
- **IPF Optimization** (`oz.exe` replication)
- **IES Conversion** (`ix3.exe` replication)
- **Folder Addition** (`af.exe` replication)

### Generic Validation Framework

The new validation layer supports validation for all IPF tools:

```javascript
// Validate any tool output against reference hashes
const validator = new ExtractValidator();
const result = await validator.validate(outputDir, referenceHashes);
```

### Supported Tool Types

- **extraction**: Validate directory outputs from IPF extraction
- **creation**: Validate .ipf files created from folders
- **optimization**: Validate optimized .ipf files
- **conversion**: Validate IES to XML/PRN conversion outputs
- **addition**: Validate .ipf files after adding folders

## Test Types

### Reference Validation

Compares output files byte-for-byte against reference output from original getools.bat tools to ensure 100% compatibility across all Granado Espada IPF operations.

### Performance Testing

Measures speed improvements over original tools, particularly our single-pass architecture that eliminates intermediate ZIP files.

### Cross-Platform Testing

Verifies consistent behavior across Linux, Windows, and macOS for users who can't run original Windows tools natively.

## Current Test Coverage

### Completed Tools

- **IPF Extraction**: Full validation against `iz.exe` + `ez.exe`
  - Test files: ai.ipf, item_texture.ipf, ui.ipf
  - Validation rate: 100% success
  - Performance: 10-15x faster than original tools

### In Progress

- **IPF Creation**: Validation against `cz.exe` + `zi.exe`
- **IES Conversion**: Validation against `ix3.exe`
- **IPF Optimization**: Validation against `oz.exe`
- **Folder Management**: Validation against `af.exe`

## Test Data Structure

### Hash-Based Testing Framework

The framework stores reference hashes in `testing/test_hashes/`:

- `testing/test_hashes/tools/extraction/original_hashes.json` - Reference hashes from original Windows tools
- `testing/test_hashes/tools/extraction/our_hashes.json` - Hashes from our Go IPF extractor

### Reference Extractions

- `testing/reference_original/` - Extractions from original Windows tools (iz.exe + ez.exe) - Permanent storage
- `testing/reference_our/` - Extractions from our Go tool - Temporary, cleaned up after tests unless `--keep` flag used

### Future Scalability

As additional tools are implemented, hash database structure will expand:
```
test_hashes/tools/
├── extraction/
│   ├── original_hashes.json
│   └── our_hashes.json
├── optimization/
│   ├── original_hashes.json
│   └── our_hashes.json
├── creation/
│   ├── original_hashes.json
│   └── our_hashes.json
└── conversion/
    ├── original_hashes.json
    └── our_hashes.json
```

## Performance Metrics

Key metrics tracked during testing:

- Extraction/creation speed (10-15x faster than original tools)
- Memory usage during operations (streaming, no memory exhaustion)
- Hash validation success rate (100% on all test files)
- Deduplication effectiveness (removes obsolete file versions)

## Hash Validation Features

The hash-based framework provides:

- **Copyright Safety**: Only hashes stored in Git, no proprietary content
- **Smart Hashing Strategy**: Adapts approach based on file collection size
- **Comprehensive Validation**: File content, structure, and performance comparison
- **Automated Testing**: Can be integrated into CI/CD pipelines
- **Reproducible Results**: Anyone with original IPF files can validate against reference hashes
- **Performance Tracking**: Automatic speedup calculations vs original tools

### Smart Hashing Strategy

The framework automatically chooses optimal validation approach:

#### **Small Collections** (< 100 files)
- **Strategy**: Full file-by-file hashing
- **Validation**: Every individual file content and hash
- **Use Case**: `ai.ipf` and similar small archives
- **Output Format**:
  ```json
  {
    "strategy": "full",
    "file_count": 4,
    "total_size": 4300,
    "files": {
      "attacker.scp": { "hash": "sha256...", "size": 11442 },
      "healer.scp": { "hash": "sha256...", "size": 6086 }
    },
    "manifest_hash": "sha256..."
  }
  ```

#### **Large Collections** (> 100 files)
- **Strategy**: Representative sampling
- **Validation**: 15 beginning + 15 middle + 15 end files (45 total, minimum 30)
- **Use Case**: `item_texture.ipf` and `ui.ipf` (large asset archives)
- **Output Format**:
  ```json
  {
    "strategy": "sampling",
    "file_count": 11567,
    "total_size": 917000000,
    "sampled_files": {
      "file1.dat": { "hash": "sha256...", "size": 1024 },
      "file5000.dat": { "hash": "sha256...", "size": 2048 },
      "file10000.dat": { "hash": "sha256...", "size": 4096 }
    },
    "sample_hash": "sha256..."
  }
  ```

This approach ensures fast validation while maintaining accuracy, keeping hash databases manageable for Git storage.

## Quick Start Guide

### Install Dependencies

```bash
cd testing
npm install
```

### Build Go Binary

```bash
cd ../src/golang
make build
# Binary built to: releases/ge-library/{platform}/tools/ipf-extractor
```

### Run Tests

```bash
cd ../../testing
npm test
```

### Expected Output

```
=== Running Full Extraction Test ===

--- Testing ai.ipf (small) ---
Extracting with our tool...
✓ Extraction completed in 0.01s
Generating hashes from our output...
Comparing with reference hashes...
✓ small: Perfect match!

--- Testing item_texture.ipf (medium) ---
Extracting with our tool...
✓ Extraction completed in 0.54s
Generating hashes from our output...
Comparing with reference hashes...
✓ medium: Perfect match!

--- Testing ui.ipf (large) ---
Extracting with our tool...
✓ Extraction completed in 1.79s
Generating hashes from our output...
Comparing with reference hashes...
✓ large: Perfect match!

=== Test Summary ===
Total test files: 3
Perfect matches: 3
Success rate: 100.0%
```

## Troubleshooting

### Binary Not Found

```
Error: Command failed: spawn ENOENT
```

**Solution**: Ensure Go binary is built:

```bash
cd src/golang
make build
```

### Permission Denied

```
Error: EACCES: permission denied
```

**Solution**: Make binary executable:

```bash
chmod +x src/golang/releases/ge-library/linux-amd64/tools/ipf-extractor
```

### Timeout Errors

```
Error: Command timed out
```

**Solution**: Increase timeout in `testing/src/config.js`:

```javascript
EXECUTION_TIMEOUT: 1200000,  // 20 minutes
EXTRACTOR_TIMEOUT: 1200000,
```

### Hash Mismatches

```
✗ large: Hash mismatch
```

**Solution**: Verify:
1. Go binary is latest version
2. Reference hashes are up to date
3. No file corruption in test files

## IPF Progressive Bloat Discovery

Through extensive testing, we discovered that Granado Espada's IPF system suffers from progressive file bloat:

### How Bloat Accumulates
- **Initial IPFs**: Contain original game files
- **Game Patches**: Add new files to existing IPFs
- **File Retention**: Old files remain even when overridden by newer versions
- **Archive Growth**: IPFs continuously increase in size with each update

### Performance Implications
- **Duplicate Files**: Multiple versions of the same file exist within single IPFs
- **Wasted Storage**: Archives contain obsolete file versions
- **Slower Extraction**: More files to process even for unchanged content
- **Inefficient Transfers**: Users download bloated archives with redundant data

### Our Solution
- **Deduplicator Module**: Filters IPF files to keep only newest version per filename
- **Algorithm**: Build map of SafeFilename → FileInfo with highest Index
- **Performance**: Reduces file count by removing obsolete versions
- **Result**: Faster extraction, reduced storage, improved performance

## Contributing

### Adding New Test Files

1. Add IPF file to `testing/test_files/` directory
2. Update `TEST_FILES` configuration in `testing/src/config.js`
3. Generate reference hashes: `npm run generateOriginal`
4. Validate: `npm run test`

### Adding New Tool Validators

1. Create new validator in `testing/src/validation/`
2. Follow existing validator pattern (ExtractValidator as reference)
3. Add CLI command in `testing/src/cli/commands/`
4. Update testing documentation

## Additional Documentation

- [Testing Framework README](../testing/README.md) - User-facing testing framework documentation
- [Testing Framework Architecture](../testing/architecture.md) - Technical architecture details
- [GO_PERFORMANCE_ANALYSIS.md](../GO_PERFORMANCE_ANALYSIS.md) - Go implementation performance analysis
