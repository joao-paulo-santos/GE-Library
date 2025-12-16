# Granado Espada Tool Library

An open-source library providing modern alternatives to the tools used in Granado Espada development and modding. This project replicates and enhances the functionality of original tools while optimizing for modern hardware and providing true cross-platform compatibility.

## Project Mission

This project creates open-source alternatives to the closed-source Windows tools used for Granado Espada development. Our tools provide:

- **Cross-platform performance** on Linux, Windows, and macOS
- **Modern hardware optimization** for multi-core systems
- **Open development** with community contributions
### Currently Completed Tools

#### IPF Archive Extractor (v1.0)
- **Replicates**: `iz.exe` + `ez.exe` functionality for IPF archive extraction
- **Performance**: 10-15x faster than original tools under wine (windows benchmarks coming soon)
- **Compatibility**: Byte-for-byte identical output when compared to original tools
- **Implementations**: Python (reference/development) + Go (production)

### Planned Future Tools

This is just the beginning. We plan to recreate the entire suite of Granado Espada development tools:

#### IPF Management Tools
- **Create IPF from Folder**: Replicate `cz.exe` + `zi.exe` functionality for creating IPF archives from folders
- **Add Folder to IPF**: Replicate `af.exe` functionality for adding content to existing IPF files
- **Optimize IPF**: Replicate `oz.exe` functionality for IPF compression and optimization

#### Data Conversion Tools
- **IES to XML/PRN Converter**: Replicate `ix3.exe` functionality for converting IES files to Excel-compatible formats

Each tool will maintain compatibility with original file formats while providing modern performance optimizations and cross-platform support.

### Beyond the Original Suite

After completing the full getools.bat tool suite, we may consider developing new tools based on community needs and technical feasibility. However, our primary focus remains on faithfully recreating and modernizing the original tooling that Granado Espada developers and modders have relied on for years.


For detailed benchmarks and technical information, see [documentation/DEVELOPMENT.md](documentation/DEVELOPMENT.md).
For testing and validation procedures, see [documentation/TESTING.md](documentation/TESTING.md).

## Quick Start

### For Users (Recommended)
Download the pre-compiled binary for your system from the `releases/` directory:

```bash
# Extract IPF file
./ipf-extractor -input archive.ipf -output extracted_files

# Use all CPU cores for maximum performance
./ipf-extractor -input archive.ipf -workers 0 -verbose
```

### For Developers
If you want to compile from source:

**Go Implementation:**
```bash
cd src/golang
go build -o ipf-extractor ./cmd/ipf-extractor
./ipf-extractor -input archive.ipf -output extracted_files
```

**Python Implementation:**
```bash
cd src/python
python ipf_extractor.py archive.ipf extracted_files
```

## Future Roadmap

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
- IPF Optimization (`oz.exe` replication)
- GUI interface for tool selection and batch operations

### Phase 3: Platform Enhancement (Planned)
- Cross-platform GUI application
- Comprehensive documentation and tutorials

## Contributing

We welcome contributions from the community!

## License

This project is provided as an open-source replacement for game development tooling. All reverse engineering was conducted for educational and preservation purposes. Please respect the game's terms of service and intellectual property rights.

---

This project represents our commitment to preserving game development tooling and making it accessible to future generations of developers and modders across all Granado Espada versions.