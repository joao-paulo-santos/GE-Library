# Development Documentation

This document contains detailed technical information for developers and contributors.

## Project Origins

### The Challenge

When attempting to run the original `getools.bat` scripts on Linux through Wine, we encountered significant performance issues and compatibility problems. The original Windows executables (`iz.exe` and `ez.exe`) had:

- **No source code available** - only binary distributions
- **Wine performance degradation** - significant overhead when running on Linux
- **Single-threaded processing** - not optimized for modern multi-core systems

### The Reverse Engineering Journey

Rather than accepting these limitations, we embarked on a comprehensive reverse engineering project to:

1. **Analyze the Original Tools**: Disassemble `iz.exe` and `ez.exe` using Rizin and other reverse engineering tools
2. **Understand the IPF Format**: Discover that IPF files are standard ZIP archives with encrypted headers and static passwords
3. **Reconstruct Algorithms**: Implement the PKZIP stream cipher for filename decryption and the 48-byte password system
4. **Optimize for Modern Hardware**: Add multi-threading, streaming processing, and memory-efficient operations
5. **Create Open Source Solution**: Build a community-maintained toolset with cross-platform support

## Architecture Overview

This project provides two complementary implementations:

### Python Reference Implementation
- **Location**: `src/python/` directory
- **Purpose**: Reference implementation for algorithm accuracy and testing
- **Advantages**: Easy to understand, modify, and extend
- **Use Case**: Development, testing, and educational purposes

### Go Production Implementation
- **Location**: `src/golang/` directory
- **Purpose**: High-performance extraction for production use
- **Advantages**: Multi-threaded, memory-efficient, cross-platform binaries
- **Use Case**: Large-scale extractions, automation, and production workflows

## Performance Architecture

### Single-Pass Optimization
Our direct extraction approach is theoretically at least 2x faster due to eliminating the intermediate ZIP file step:

### Performance Improvements
- **Multi-threaded Processing**: Parallel filename decryption and file extraction
- **Memory Efficiency**: Streaming processing for large files (>2GB support)
- **Modern I/O**: Optimized buffer management and async operations
- **Cross-platform**: Native performance on Linux, Windows, and macOS

## Testing Framework

For detailed testing procedures and validation, see [TESTING.md](TESTING.md).

## Technical Details

### IPF Format Discovery
Through extensive binary analysis, we discovered that IPF files are:

1. **Standard ZIP Archives**: Compatible with existing ZIP libraries
2. **Password Protected**: All files use the same 48-byte password
3. **Encrypted Headers**: Filenames encrypted using PKZIP stream cipher
4. **Standard Compression**: Use standard ZIP compression methods
5. **Version Independent**: Format consistent across all Granado Espada releases
6. **Progressive Bloat**: Game patchers add new files to existing IPFs without removing old versions

### IPF Progressive Bloat

Granado Espada's IPF system suffers from progressive file bloat:

#### How Bloat Accumulates
- **Initial IPFs**: Contain original game files
- **Game Patches**: Add new files to existing IPFs
- **File Retention**: Old files remain even when overridden by newer versions
- **Archive Growth**: IPFs continuously increase in size with each update

#### Performance Implications
- **Duplicate Files**: Multiple versions of the same file exist within single IPFs
- **Wasted Storage**: Archives contain obsolete file versions
- **Slower Extraction**: More files to process even for unchanged content
- **Inefficient Transfers**: Users download bloated archives with redundant data

### Decryption Algorithm
- **PKZIP Stream Cipher**: Industry-standard encryption algorithm
- **Three-Key System**: 32-bit keys updated using CRC32 of processed bytes
- **Static Password**: Hardcoded 48-byte key embedded in `ez.exe`
- **Local Header Reading**: Encrypted filenames stored at offset 30 in local headers

### Performance Optimizations
- **Parallel Processing**: Separate worker pools for CPU vs I/O bound operations
- **Memory Pooling**: Reuse buffers to reduce garbage collection pressure
- **Smart Buffering**: Dynamic buffer sizing based on storage type
- **Streaming Architecture**: Process files without loading entire archive into memory

## Project Structure

```
ipf_decompiler/                 # Main project directory
├── README.md                    # Main project documentation
├── documentation/               # Technical documentation
│   ├── DEVELOPMENT.md          # Development and architecture guide
│   ├── TESTING.md              # Testing framework and validation
│   └── commands.md             # Command reference
├── src/                         # Source code directory
│   ├── python/                  # Python reference implementation
│   │   ├── ipf_extractor.py    # Main extraction tool
│   │   └── tests/               # Test suite and validation tools
│   └── golang/                  # Go production implementation
│       ├── cmd/ipf-extractor/   # CLI application
│       ├── pkg/ipf/             # Core IPF extraction logic
│       └── pkg/zipcipher/       # ZIP decryption implementation
├── testing_goals/               # Reference extractions from original tools
├── benchmarks/                  # Performance benchmarking tools
├── releases/                    # Built binaries and release packages
├── iz.exe                      # Original Windows tool (for reference)
├── ez.exe                      # Original Windows tool (for reference)
├── CLAUDE.md                   # Development context and guidelines
└── GO_PERFORMANCE_ANALYSIS.md  # Detailed performance analysis
```

## Contributing

We welcome contributions from the community! Areas where we need help:

### Code Contributions
- **Performance Optimization**: SIMD instructions, GPU acceleration
- **Additional Platforms**: ARM, mobile platforms
- **User Interface**: GUI applications, web interfaces
- **Integration**: Modding tools, development pipelines

### Testing & Validation
- **Compatibility Testing**: Different IPF file versions and variants
- **Performance Testing**: Various hardware configurations
- **Regression Testing**: Automated testing against original tools
- **Edge Case Handling**: Corrupted files, malformed archives

### Documentation & Community
- **Tutorials**: Getting started guides, use cases
- **Translation**: Localize for international communities
- **Examples**: Real-world usage patterns and integrations