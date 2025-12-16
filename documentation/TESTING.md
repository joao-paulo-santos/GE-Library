# Testing and Validation

This document covers testing procedures to validate our Granado Espada Tool Library implementations against the original Windows tools.

## Current Project Status

Our project aims to recreate the complete getools.bat tool suite. Currently, we've completed IPF extraction and are working on the remaining tools: IPF creation, optimization, IES conversion, and folder management.

## IPF Extraction Testing (Completed)

### Against Original Tools
```bash
# Create reference extraction using original iz.exe + ez.exe
wine iz.exe archive.ipf
wine ez.exe archive.zip

# Compare with our implementation
./ipf-extractor -input archive.ipf -output our_extraction
python ../src/python/tests/compare_extractions.py our_extraction/ reference_extraction/
```

### Performance Benchmarking
```bash
# Run benchmarks against original tools
cd src/golang
../../benchmark.sh

# Compare Python and Go implementations
python ../src/python/tests/benchmark.py ../../archive.ipf
```

## Future Tool Testing (In Progress)

### Upcoming Tools to Test
- **IPF Creation** (`cz.exe` + `zi.exe` replication)
- **IPF Optimization** (`oz.exe` replication)
- **IES Conversion** (`ix3.exe` replication)
- **Folder Addition** (`af.exe` replication)

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

Reference extractions from original tools are stored in `testing_goals/` directory. Each tool has its own reference data to validate against.

## Performance Metrics

Key metrics tracked during testing:
- Extraction/creation speed
- Memory usage during operations
- Single-pass vs two-pass performance
- Cross-platform compatibility
