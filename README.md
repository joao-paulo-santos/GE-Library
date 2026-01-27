# Granado Espada Tool Library

An open-source library providing modern alternatives to tools used in Granado Espada development and modding. This project replicates and enhances the functionality of original tools while optimizing for modern hardware and providing true cross-platform compatibility.

## Project Mission

This project creates open-source alternatives to the closed-source Windows tools used in Granado Espada development. Our tools provide:

- **Cross-platform support** on Linux, Windows, and macOS
- **Modern hardware optimization** for multi-core systems
- **Open development** with community contributions
- **100% compatibility** with original file formats

## Currently Completed Tools

### IPF Archive Extractor (v0.1)
- **Replicates**: `iz.exe` + `ez.exe` functionality for IPF archive extraction
- **Performance**: Faster than original tools (10-15x when tested under Wine, Windows benchmarks pending)
- **Compatibility**: Byte-for-byte identical output when compared to original tools
- **Implementations**: Python (reference/development) + Go (production)

### IPF Archive Optimizer (v0.1)
- **Replicates**: `oz.exe` functionality for IPF optimization
- **Features**: Removes duplicate files from IPF archives to reduce size
- **Performance**: Significantly reduces file count and archive size
- **Compatibility**: Byte-for-byte identical output when compared to original tools
- **Implementation**: Go (production)

## Planned Future Tools

### IPF Management Tools
- **Create IPF from Folder**: Replicate `cz.exe` + `zi.exe` functionality for creating IPF archives from folders
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
./ipf-optimizer -input archive.ipf -backup
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

We use a comprehensive testing framework to validate our tools against original Windows tools:

- **Hash-based validation**: Compare outputs byte-for-byte
- **Automated test suite**: Run extraction and optimization tests
- **Cross-platform validation**: Verify consistent behavior across platforms

### Phase 1: Foundation (Complete)
- Reverse engineer `iz.exe` and `ez.exe` functionality
- Create Python reference implementation
- Develop Go production implementation
- Establish testing framework
- Cross-platform compatibility

### Phase 2: Complete Original Tool Suite (In Progress)
- IPF Creation from Folder (`cz.exe` + `zi.exe` replication)
- Add Folder to IPF (`af.exe` replication)
- IES to XML/PRN Converter (`ix3.exe` replication)
- GUI interface for tool selection and batch operations

### Phase 3: Platform Enhancement (Planned)
- Cross-platform GUI application
- Comprehensive documentation and tutorials
- Windows native performance benchmarks

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