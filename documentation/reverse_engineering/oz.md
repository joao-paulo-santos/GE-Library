# oz.exe Reverse Engineering Analysis

## Binary Structure

- **File Type**: PE32 executable for MS Windows 4.00 (console), Intel i386
- **Size**: 20KB (20,480 bytes)
- **Sections**: .text, .rdata, .data
- **Entry Point**: 0x004012b0

## Imported Functions

### KERNEL32.dll
- CreateFileA
- ReadFile
- WriteFile
- SetFilePointer
- SetEndOfFile
- CloseHandle

### MSVCRT.dll
- printf
- operator new
- free
- exit

### MSVCP60.dll
- std::_Lockit

## Key Functions

### fcn.004012b0 (Entry Wrapper)
- **Size**: 13 bytes
- **Purpose**: Simple wrapper calling fcn.004011b0

### fcn.00401a50 (Main Orchestrator)
- **Size**: 1072 bytes
- **Purpose**: Orchestrates IPF optimization process
- **Operations**:
  - ZIP signature verification
  - Memory allocation
  - Calls helper functions for optimization

### fcn.00402330 (Core Deduplication)
- **Size**: 1312 bytes
- **Purpose**: Core deduplication and ZIP reconstruction
- **Operations**:
  - Creates array of file info structures
  - Performs comparison operations
  - Reconstructs optimized ZIP structure

### Helper Functions
- fcn.00402cd0 (686 bytes): File comparison
- fcn.00402bb0 (686 bytes): Data manipulation
- fcn.004028b0 (19 bytes): Memory operations
- fcn.00402fd0: Deduplication logic

## ZIP Signature Checks

Three ZIP format signatures verified:

1. **Local File Header**: 0x04034b50 at offset 0x00401ab6
2. **Central Directory**: 0x02014b50 at offset 0x00401b38
3. **End of Central Directory**: 0x06054b50 at offset 0x00401bb9

## Memory Structure

- **File Info Array**: 8-byte structures indexed by `[esi + 8*index + offset]`
- **Accessed Offsets**: 4, 0x0c, 0x14 in array elements
- **Loop Pattern**: Iterates through files using `inc edi` with conditional jumps

## Deduplication Logic

- **Purpose**: Removes duplicate file versions from IPF archives
- **Selection**: Keeps higher indexed version of each file
- **Method**: Compares file attributes via comparison functions

## File I/O Behavior

- **Mode**: In-place file modification
- **Truncation**: Uses SetEndOfFile to reduce file size
- **File Access**: Single CreateFileA call (no temporary files)
- **Strategy**: Reads entire structure into memory, processes, writes optimized version

## Error Messages

### File Access Errors
- "error : ::CreateFile() failed."
- "error : invalid central item."

### ZIP Structure Errors
- "error : local item doesn't exist."
- "error : central info doesn't exist."
- "error : unknown signature."
- "error : invalid end of centraldirectory."

### User Messages
- "processing is loading the file..."
- "processing is saving the file..."

## ZIP Header Parsing

The tool reads and validates standard ZIP header structures:

- **Local File Header** (30 bytes + variable filename)
- **Central Directory Header** (46 bytes + variable)
- **End of Central Directory** (22 bytes)

 Reads CRC32 values (offset 14 in local header) and filename data (offset 30) from each file.

## Critical Format Details Discovered

### General Purpose Flags
- **Local File Headers**: `0x0009` (bit 0 = encrypted, bit 3 = data descriptor)
- **Central Directory**: `0x0009` (same as local headers)

### Data Descriptors
- **Size**: 16 bytes per file (appended after compressed data)
- **Structure**:
  - Offset 0-3: Signature `0x08074b50`
  - Offset 4-7: CRC32
  - Offset 8-11: Compressed Size
  - Offset 12-15: Uncompressed Size
- **Purpose**: Despite GenPurpose bit 3 being set, oz.exe writes data descriptors after all files

### Version Made By Field
- **Value**: `0x0014` (ZIP 2.0) in all optimized IPF central directory entries
- **Original IPFs**: Typically have `0x0000` (ZIP 0.0)
- **Note**: oz.exe always overwrites this field to `0x0014` during optimization

### Central Directory Structure
Standard 46-byte entries with proper alignment:
- Internal attributes: 2 bytes at offset 32 (always 0)
- External attributes: 4 bytes at offset 36 (always 0)
- Local header offset: 4 bytes at offset 40 (correctly set)

## Optimization Statistics

### Example Results (ui.ipf)
- **Original**: 26,571 files (879 MB)
- **Optimized**: 11,568 files (421 MB)
- **Removed**: 15,003 duplicate files (56.5% reduction)
- **Size Reduction**: 458 MB (52.1%)

## File Reconstruction Process

1. Read all file structures into memory
2. Identify duplicate filenames
3. Retain highest-indexed version of each file
4. Rebuild ZIP structure:
   - Local file headers (with GenPurpose = 0x0009)
   - Compressed data (copied byte-for-byte)
   - Data descriptors (16 bytes per file)
   - Central directory entries (with Version Made By = 0x0014)
   - End of central directory
5. Truncate file to new size

## Byte-for-Byte Compatibility Requirements

To match oz.exe output exactly:
1. GenPurpose flags must be `0x0009` (not `0x0001`)
2. Data descriptors must be written (16 bytes per file)
3. Version Made By must be `0x0014` in central directory
4. File order must preserve original indices of retained files
5. All compressed data must be copied exactly without modification

## Implementation Notes

**Design Decision**: Our ipf-optimizer was developed to match oz.exe output byte-for-byte to ensure compatibility with existing tools and game clients.

**Important Note**: The way oz.exe handles IPF format may not be optimal:

- **Data Descriptors**: oz.exe uses GenPurpose bit 3 (data descriptor flag) and writes 16-byte data descriptors after compressed data, despite the compressed size being present in the header. This adds 185 KB (11,568 files × 16 bytes) to the archive without providing additional value.
- **Version Made By**: oz.exe always overwrites to `0x0014` (ZIP 2.0) even when original IPFs have `0x0000` (ZIP 0.0), suggesting unnecessary field modification.
- **Format Quirks**: Some oz.exe behaviors (like data descriptors with known sizes) appear to be legacy decisions rather than optimal ZIP format usage.

**Future Improvements**: While we currently implement oz.exe's exact behavior for compatibility, we may improve the IPF structure in future versions:
- Remove redundant data descriptors when compressed size is already known
- Preserve original Version Made By values
- Optimize ZIP structure for better compression and smaller archives

For now, byte-for-byte compatibility with oz.exe ensures maximum compatibility while allowing us to validate optimization results.
