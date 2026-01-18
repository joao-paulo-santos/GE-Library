# Testing and Validation

This document covers testing procedures to validate our Granado Espada Tool Library implementations against the original tools.

## Current Project Status

Our project aims to recreate the complete getools.bat tool suite. Currently, we've completed IPF extraction and are working on the remaining tools: IPF creation, optimization, IES conversion, and folder management.

## IPF Extraction Testing (Completed)

### Hash-Based Validation Framework

We use a hash-based testing system to validate our implementations against the original tools without distributing copyrighted IPF files.

#### Reference Test Files
We validate against three test files from Granado Espada Classique:
- **Small**: `ai.ipf` (4.3K, 4 files) - AI game logic data - Full hash validation
- **Medium**: `item_texture.ipf` (191MB, 3,063 files) - Item texture assets - Sampling validation
- **Large**: `ui.ipf` (877MB, 11,567 files) - User interface assets - Sampling validation

#### For Users - Validate Compiled Builds
```bash
# From testing directory - validate compiled extractor against reference hashes (runs tool + validates)
python validate_hashes.py --ipf-path /path/to/project/root

# With detailed output
python validate_hashes.py --verbose

# For CI/CD - validate pre-existing extraction results against reference hashes
python validate_results.py --output ./extraction_directory --tool extraction --test-key small

# Validate multiple outputs at once
python validate_results.py --output-map '{"small": "./small_output", "medium": "./medium_output"}' --tool extraction

# Generate JSON report for automated systems
python validate_results.py --output ./results --tool extraction --test-key small --report-json validation_report.json --quiet
```

#### For Maintainers - Generate Reference Hashes
```bash
# From testing directory - regenerate reference hashes (requires original tools)
cd testing
python generate_hashes.py [--ipf-path /path/to/ipf/files]

# Platform Requirements:
# - Windows: Native execution of iz.exe and ez.exe tools
# - Linux/Mac: Wine installed and configured for Windows tool execution
```

## Future Tool Testing (In Progress)

### Upcoming Tools to Test
- **IPF Creation** (`cz.exe` + `zi.exe` replication)
- **IPF Optimization** (`oz.exe` replication)
- **IES Conversion** (`ix3.exe` replication)
- **Folder Addition** (`af.exe` replication)

### Generic Validation Framework
The new `ToolOutputValidator` class supports validation for all IPF tools:

```python
# Validate any tool output against reference hashes
validator = ToolOutputValidator("reference_hashes.json", tool_type="creation")
result = validator.validate_tool_output("./created.ipf", "small_folder")
```

### Supported Tool Types
- **extraction**: Validate directory outputs from IPF extraction
- **creation**: Validate .ipf files created from folders
- **optimization**: Validate optimized .ipf files
- **conversion**: Validate IES to XML/PRN conversion outputs
- **addition**: Validate .ipf files after adding folders

### CI/CD Integration Examples

```bash
# Validate IPF creation
python validate_results.py --output ./new_archive.ipf --tool creation --test-key small_folder

# Validate IES conversion
python validate_results.py --output ./converted_files --tool conversion --test-key sample_ies

# Validate multiple tool outputs in one pipeline stage
python validate_results.py --output-map '{
  "small": "./small_extraction",
  "medium": "./medium_extraction",
  "created": "./new_archive.ipf"
}' --tool extraction --test-key small
```

Each new tool will follow the same validation pattern: compare against original Windows tools to ensure 100% compatibility.

## Test Types

### Reference Validation
Compares output files byte-for-byte against reference output from original getools.bat tools to ensure 100% compatibility across all Granado Espada IPF operations.

### Performance Testing
Measures speed improvements over the original tools, particularly our single-pass architecture that eliminates intermediate ZIP files.

### Cross-Platform Testing
Verifies consistent behavior across Linux, Windows, and macOS for users who can't run the original Windows tools natively.

## Current Test Coverage

### Completed Tools
- **IPF Extraction**: Full validation against `iz.exe` + `ez.exe`

### In Progress
- **IPF Creation**: Validation against `cz.exe` + `zi.exe`
- **IES Conversion**: Validation against `ix3.exe`
- **IPF Optimization**: Validation against `oz.exe`
- **Folder Management**: Validation against `af.exe`

## Test Data Structure

### Hash-Based Testing Framework
- `testing/test_hashes/` - Version-controlled hash databases and validation tools
- `testing/test_hashes/tools/extraction_hashes.json` - Reference hashes from original Windows tools
- `testing/test_hashes/validation_report.json` - Latest validation results and performance metrics
- `testing/validate_hashes.py` - IPF extraction validation script (runs tool + validates)
- `testing/validate_results.py` - Generic validation script for any tool output (CI/CD compatible)
- `testing/tool_output_validator.py` - Generic validation class for all IPF tools
- `testing/generate_hashes.py` - Maintainer script for hash regeneration (Windows: native, Linux/Mac: Wine)

### Traditional Testing
Reference extractions from original tools are stored in `testing_goals/` directory. Each tool has its own reference data to validate against.

### Workflow Scripts (Local Only)
- Contains scripts that require original Windows tools and proprietary IPF files

## Performance Metrics

Key metrics tracked during testing:
- Extraction/creation speed
- Memory usage during operations
- Hash validation success rate

## Hash Validation Features

The hash-based framework provides:
- **Copyright Safety**: Only hashes stored in Git, no proprietary content
- **Smart Hashing Strategy**: Adapts approach based on file collection size
- **Comprehensive Validation**: File content, structure, and performance comparison
- **Automated Testing**: Can be integrated into CI/CD pipelines
- **Reproducible Results**: Anyone with original IPF files can validate against reference hashes
- **Performance Tracking**: Automatic speedup calculations vs original tools

### Smart Hashing Strategy

The framework automatically chooses the optimal validation approach:

#### **Small Collections** (< 50 files, < 10MB)
- **Strategy**: Full file-by-file hashing
- **Validation**: Every individual file content and hash
- **Use Case**: `ai.ipf` and similar small archives

#### **Medium Collections** (50-200 files, 10-100MB)
- **Strategy**: Representative sampling
- **Validation**: First 10 + last 10 + random 20 files + directory structure
- **Use Case**: `item_texture.ipf` and medium-sized archives

#### **Large Collections** (> 200 files, > 100MB)
- **Strategy**: Metadata with sampling
- **Validation**: File count, total size, directory structure, 30 sample files
- **Use Case**: `ui.ipf` and large asset archives

This approach ensures fast validation while maintaining accuracy, keeping hash databases manageable for Git storage.
