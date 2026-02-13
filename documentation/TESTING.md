# Testing and Validation

This document covers testing procedures to validate our Granado Espada Tool Library implementations against original tools.

## Documentation Links

- [Testing Framework Usage](../testing/README.md) - Commands, configuration, troubleshooting, CI/CD
- [Testing Framework Architecture](../testing/architecture.md) - Technical architecture and implementation

## Current Project Status

Our project aims to recreate the complete getools.bat tool suite. Currently, we've completed IPF extraction, IPF optimization, and IPF creation. Remaining tools include: IES conversion and folder management.

## Testing Framework

We use a modular JavaScript-based testing framework to validate our implementations against original tools. The framework is located in `testing/` directory and uses hash-based comparison to ensure 100% compatibility.

For framework usage and commands, see [Testing Framework Usage](../testing/README.md).

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

The testing framework provides npm scripts for easy validation. For detailed command reference and options, see [Testing Framework Usage](../testing/README.md).

### For Maintainers - Generate Reference Hashes

To regenerate reference hashes (requires original Windows tools):

```bash
cd testing

# Generate reference hashes from original tool extractions
npm run generate

# This runs iz.exe + ez.exe on extraction test files and oz.exe on optimization test files, saving:
# - testing/test_hashes/tools/extraction/original_hashes.json (hash database)
# - testing/test_hashes/tools/optimization/original_hashes.json (hash database)
# - testing/reference_original/ (extracted files)
```

Platform Requirements:
- **Windows**: Native execution of iz.exe, ez.exe, and oz.exe tools
- **Linux/Mac**: Wine installed and configured for Windows tool execution

## Future Tool Testing

### Upcoming Tools to Test

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
  - Performance: Faster than original tools (10-15x when tested under Wine)

- **IPF Optimization**: Full validation against `oz.exe`
  - Test files: ui.ipf → ui_optimized.ipf
  - Validation rate: 100% success (hash, size, file count all match)
  - Performance: Optimizes duplicate file removal

- **IPF Creation**: Full validation against `cz.exe` + `zi.exe`
  - Test files: ui.ipf (extract → create → extract → compare)
  - Validation rate: 100% success (extracted content matches reference)
  - Performance: Faster than original two-step workflow

### Planned Tools

- **IES Conversion**: Validation against `ix3.exe`
- **Folder Management**: Validation against `af.exe`

## Test Data Structure

### Hash-Based Testing Framework

The framework stores reference hashes in `testing/test_hashes/`. For detailed structure and organization, see [Testing Framework Usage](../testing/README.md).

## Performance Metrics

Key metrics tracked during testing:

- Extraction/creation speed (faster than original tools, 10-15x when tested under Wine)
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

For troubleshooting common issues, see [Testing Framework Usage - Troubleshooting](../testing/README.md#troubleshooting).

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
3. Generate reference hashes: `npm run generate`
4. Validate: `npm run test`

### Adding New Test Commands

Each test command implements its own validation logic inline:

1. Create new command file in `testing/src/cli/commands/` (e.g., `test-creation.js`)
2. Import required utilities:
   - `executeCommand` from `../../executor`
   - `calculateFileHash` or `calculateDirectoryHash` from `../../hash`
   - `writeJson` and other FS functions from `../../filesystem`
   - `countIPFFiles` from `../../count-ipf-files` (for IPF operations)
3. Implement inline comparison logic (see existing commands as examples)
4. Register command in `testing/src/cli/cli-runner.js`
5. Update testing documentation

## Additional Documentation

- [Testing Framework Usage](../testing/README.md) - Commands, configuration, troubleshooting
- [Testing Framework Architecture](../testing/architecture.md) - Technical architecture details
- [GO_PERFORMANCE_ANALYSIS.md](../GO_PERFORMANCE_ANALYSIS.md) - Go implementation performance analysis
