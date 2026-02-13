# Granado Espada Tool Library (v0.2)

An open-source library providing modern alternatives to tools used in Granado Espada development and modding. This project replicates and enhances the functionality of original tools while optimizing for modern hardware and providing true cross-platform compatibility.

## Project Mission

This project creates open-source alternatives to the closed-source Windows tools used in Granado Espada development. Our tools provide:

- **Cross-platform support** on Linux, Windows, and macOS
- **Modern hardware optimization** for multi-core systems
- **Open development** with community contributions
- **100% compatibility** with original file formats

## Completed Tools

### IPF Archive Extractor
- **Replicates**: `iz.exe` + `ez.exe` functionality for IPF archive extraction
- **Performance**: Faster than original tools (10-15x when tested under Wine, Windows benchmarks pending)
- **Compatibility**: Byte-for-byte identical output when compared to original tools
- **Implementations**: Python (reference/development) + Go (production)

### IPF Archive Optimizer
- **Replicates**: `oz.exe` functionality for IPF optimization
- **Features**: Removes duplicate files from IPF archives to reduce size
- **Performance**: Significantly reduces file count and archive size (52% size reduction on test archives)
- **Compatibility**: Byte-for-byte identical output when compared to original tools
- **Implementation**: Go (production)

### IPF Archive Creator
- **Replicates**: `cz.exe` + `zi.exe` functionality for creating IPF archives from folders
- **Features**: Single-pass creation (folder to IPF directly), optional encryption, configurable compression
- **Performance**: Faster than original two-step workflow (cz.exe + zi.exe)
- **Compatibility**: 100% compatible with original IPF format
- **Implementation**: Go (production)

## Planned Future Tools

### IPF Management Tools
- **Add Folder to IPF**: Replicate `af.exe` functionality for adding content to existing IPF files

### Data Conversion Tools
- **IES to XML/PRN Converter**: Replicate `ix3.exe` functionality for converting IES files to Excel-compatible formats

Each tool will maintain compatibility with original file formats while providing modern performance optimizations and cross-platform support.

## Quick Start

### For Users (Recommended)

Download pre-compiled binary for your system from the `releases/` directory:

```bash
# Extract an IPF archive
./ipf-extractor -input archive.ipf -output extracted_files

# Use all CPU cores for maximum performance
./ipf-extractor -input archive.ipf -workers 0 -verbose

# Optimize an IPF archive (removes duplicate files)
./ipf-optimizer archive.ipf

# Optimize with backup
./ipf-optimizer -backup archive.ipf

# Create an IPF archive from a folder
./ipf-creator -folder ./my_files -output archive.ipf
```

### For Developers

If you want to compile from source:

**Go Implementation:**
```bash
cd src/golang
make build
# Binaries built to: releases/ge-library/{platform}/tools/
```

**Testing:**
```bash
cd testing
npm install
npm test
```

## Testing

We use a comprehensive testing framework to validate our tools against original Windows tools using hash-based comparison for byte-for-byte compatibility.

For testing framework usage and commands, see [Testing Framework](testing/README.md).
For testing strategy and coverage, see [Testing Documentation](documentation/TESTING.md).

## Contributing

We welcome contributions from the community!


## Documentation

- **[DEVELOPMENT.md](documentation/DEVELOPMENT.md)** - Technical development guide and architecture
- **[TESTING.md](documentation/TESTING.md)** - Testing procedures and validation
- **[testing/README.md](testing/README.md)** - Testing framework documentation

## License

This project is provided as an open-source replacement for game development tooling. All reverse engineering was conducted for educational and preservation purposes. Please respect the game's terms of service and intellectual property rights.

---

This project represents our commitment to preserving game development tooling and making it accessible to future generations of developers and modders across all Granado Espada versions.