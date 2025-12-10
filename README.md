# Granado Espada IPF Decompiler

A Linux-compatible tool for extracting and decompiling proprietary `.ipf` files from Granado Espada. This tool replicates the functionality of BOTH original Windows executables (`iz.exe` + `ez.exe`), combining the IPF-to-ZIP conversion and password-protected ZIP extraction into a single unified tool.

## Overview

IPF files use a **two-stage extraction process**:

1. **Stage 1**: `iz.exe` converts IPF files to password-protected ZIP format while decrypting filenames using a complex ZIP stream cipher algorithm
2. **Stage 2**: `ez.exe` extracts files from the password-protected ZIP using a hardcoded 48-byte password

This tool combines both stages, directly extracting files from IPF archives with proper filename decryption and password authentication.

## The Discovery Process

**Initial Reverse Engineering**: Extensive analysis of `iz.exe` using Rizin revealed sophisticated filename decryption algorithms. The analysis was actually CORRECT for `iz.exe`'s functionality, but we initially thought it handled the entire process.

**Breakthrough Discovery**: Through detailed investigation, we discovered:
- `iz.exe` only handles IPF→ZIP conversion and filename decryption (NO password handling)
- `ez.exe` contains the hardcoded 48-byte password and handles ZIP extraction using the Gilles Vollant unzip library
- The password is NOT read from `ipfpassword.txt` in this version - it's embedded directly in `ez.exe`

**Final Solution**: Our tool combines both stages - it performs the IPF-to-ZIP conversion with filename decryption (like `iz.exe`) AND the password-protected ZIP extraction (like `ez.exe`) in a single step.

## Quick Start

### Prerequisites

- Python 3.6 or higher
- Standard Python libraries: `sys`, `os`, `zipfile`, `struct`, `io`

### Usage

```bash
# Extract an IPF file to the default directory
python ipf_extractor.py <file.ipf>

# Extract to a specific directory
python ipf_extractor.py <file.ipf> <output_directory>
```

### Examples

```bash
# Extract AI scripts from ai.ipf
python ipf_extractor.py ai.ipf extracted_ai

# Extract character models
python ipf_extractor.py character.ipf character_models

# Extract all game resources
python ipf_extractor.py ge.ipf game_resources
```

## Technical Details

### IPF File Format

GE IPF files are standard ZIP archives with:
- **Static Password Protection**: All files use the same 48-byte password
- **Encrypted Filenames**: Filenames are encrypted using the PKZIP stream cipher
- **Standard ZIP Compression**: Files use standard ZIP compression methods

### Decryption Method

The tool implements:
1. **ZIP Stream Cipher**: Proper PKWARE encryption algorithm for filename decryption
2. **Static Password**: Uses the correct 48-byte password for archive access
3. **Local Header Reading**: Reads encrypted filenames from local ZIP headers

### Extracted File Types

Common file types found in IPF archives:
- `.scp` - AI scripts and game logic
- `.dds` - Texture files
- `.xsm` - 3D model files
- `.lua` - Lua script files
- `.xml` - Configuration files
- Various game assets and resources

## File Structure

```
ipf_decompiler/
├── README.md                    # This documentation
├── ipf_extractor_final.py       # Main extraction tool
├── ipf_extractor_fixed.py       # Alternative extraction tool
├── ipf_extractor.py            # Original reverse-engineered attempt
└── extracted/                  # Default output directory
    ├── attacker.scp            # Example extracted AI script
    ├── healer.scp
    ├── lib.scp
    └── puppet.scp
```

## Implementation Notes

### Reverse Engineering Process

**Stage 1 Analysis (iz.exe)**:
- reverse engineering using Rizin static analysis
- Discovered complex filename decryption using ZIP stream cipher algorithm
- Confirmed that `iz.exe` converts IPF → password-protected ZIP format (doesn't extract files)
- The filename decryption algorithm was correctly identified and is exactly what `iz.exe` uses

**Stage 2 Analysis (ez.exe)**:
- Identified as standard ZIP extraction tool using Gilles Vollant's unzip library
- The 48-byte password is hardcoded directly in `ez.exe`
- Found format strings and password bytes at address 0x00407114 in `ez.exe`

### Algorithm Details

The ZIP stream cipher implementation follows the PKWARE encryption standard:

- **Initialization**: Three 32-bit keys initialized with static values
- **Key Updates**: CRC32-based key updates for each processed byte
- **Decryption**: XOR-based decryption with pseudo-random byte generation

## Example Output

```bash
$ python ipf_extractor_final.py ai.ipf

Processing 'ai.ipf'...
Using static password: 256620256620257320257320ffffffff3f5b20ffffffff3f25662025662025732068202573202e3f2e20202058ff2424
Found 4 files in archive

[1/4] Processing file...
Decoded filename: attacker.scp
Extracting to: extracted/attacker.scp
✓ Successfully extracted: attacker.scp (11442 bytes)

[2/4] Processing file...
Decoded filename: healer.scp
Extracting to: extracted/healer.scp
✓ Successfully extracted: healer.scp (6086 bytes)

✓ Extraction completed! Files saved to: extracted
```

## Contributing

This tool was developed through reverse engineering the original Windows executable. Contributions for improvement, bug fixes, or additional features are welcome.

## License

This tool is provided for educational and reverse engineering purposes. Please respect the game's terms of service and intellectual property rights.

## Version History

- **v1.0**: Complete IPF extraction with filename decryption
- **v0.9**: Static password implementation
- **v0.8**: Initial reverse engineering attempts

---

**Note**: This tool was developed to replace lost tooling for game development and modding purposes. Use responsibly and in accordance with applicable laws and terms of service.