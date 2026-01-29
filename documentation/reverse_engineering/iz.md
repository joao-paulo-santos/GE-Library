# iz.exe Reverse Engineering Analysis

## Binary Structure

- **File Type**: PE32 executable for MS Windows 4.00 (console), Intel i386
- **Size**: 18,944 bytes (18.5 KB)
- **Sections**: .text, .rdata, .data
- **Entry Point**: 0x00400400
- **Compiled**: Tue Jun 17 05:53:33 2014 UTC
- **Language**: C

## Imported Functions

### KERNEL32.dll
- CreateFileA
- CreateFileMappingA
- MapViewOfFile
- UnmapViewOfFile
- CloseHandle
- GlobalAlloc
- GlobalFree
- GetFileSize
- CopyFileA
- lstrcpyA

### MSVCRT.dll
- printf
- _mbsicmp
- malloc
- free
- _controlfp
- exit
- __getmainargs
- _initterm
- __setusermatherr
- _adjust_fdiv
- __set_app_type
- __p__fmode
- __p__commode
- __p___initenv
- _except_handler3
- __CxxFrameHandler
- _CxxThrowException
- ??2@YAPAXI@Z
- ??1type_info@@UAE@XZ
- _XcptFilter

### SHLWAPI.dll
- PathFindExtensionA
- PathRenameExtensionA

## Key Functions

### fcn.00400400 (Entry Point)
- **Size**: Entry point at code section start
- **Purpose**: Main entry wrapper

### fcn.004019e4 (Local File Header Validation)
- **Address**: 0x004019e4
- **Purpose**: Validates ZIP local file header signature
- **Operations**:
  - Compares against 0x04034b50 (Local File Header signature)
  - Calls allocation function with size 0x2e (46 bytes)
  - Validates header structure

### fcn.00401a67 (Central Directory Validation)
- **Address**: 0x00401a67
- **Purpose**: Validates ZIP central directory signature
- **Operations**:
  - Compares against 0x02014b50 (Central Directory signature)
  - Calls allocation function with size 0x4a (74 bytes)
  - Validates central directory entry structure

### fcn.00401af2 (End of Central Directory Validation)
- **Address**: 0x00401af2
- **Purpose**: Validates ZIP end of central directory signature
- **Operations**:
  - Compares against 0x06054b50 (End of Central Directory signature)
  - Calls allocation function with size 0x22 (34 bytes)
  - Validates end record structure

### fcn.0040263a (ZIP Cipher Key Initialization)
- **Address**: 0x0040263a
- **Purpose**: Initializes PKZIP stream cipher encryption keys
- **Operations**:
  - Sets key1 to 0x12345678
  - Sets key2 to 0x23456789
  - Sets key3 to 0x34567890

## ZIP Signature Checks

Three ZIP format signatures verified by iz.exe:

1. **Local File Header**: 0x04034b50 at address 0x004019e4
2. **Central Directory**: 0x02014b50 at address 0x00401a67
3. **End of Central Directory**: 0x06054b50 at address 0x00401af2

## Memory Structure

### Section Layout
- **.text**: 0x194a bytes (6,474 bytes) - Code section
- **.rdata**: 0x261e bytes (9,758 bytes) - Read-only data
- **.data**: 0x290 bytes (656 bytes) - Read/write data

### Data Structures
- **Local File Header**: 46-byte allocation
- **Central Directory Entry**: 74-byte allocation
- **End of Central Directory**: 34-byte allocation
- **Encryption Keys**: 12 bytes (three 4-byte keys)

### CRC32 Table
- **Location**: Offset 0x02e90 in .rdata section
- **Size**: 256 entries × 4 bytes = 1,024 bytes
- **Purpose**: PKZIP cipher key updates

## Filename Decryption Algorithm

### PKZIP Stream Cipher
iz.exe implements the standard PKZIP stream cipher for filename decryption:

**Key Initialization**:
```
key1 = 0x12345678
key2 = 0x23456789
key3 = 0x34567890
```

**Key Update Function** (applied per byte):
```
key1 = CRC32(key1, plaintext_byte)
key2 = (key2 + (key1 & 0xff)) × 134775813 + 1
key3 = CRC32(key3, key2 >> 24)
```

**Decryption**:
```
plaintext_byte = ciphertext_byte ^ ((key2 & 0xffff | 2) × ((key2 & 0xffff | 2) ^ 1) >> 8) & 0xff
update_keys(plaintext_byte)
```

### Password System
The IPF password is stored as ASCII string in the binary:
- **String**: "?%f %f %s h %s .?.   X"
- **Bytes**: 0x25 0x66 0x20 0x25 0x66 0x20 0x25 0x73 0x20 0x25 0x73 0x20 0xFF 0xFF 0xFF 0xFF 0x3F 0x5B 0x20 0xFF 0xFF 0xFF 0xFF 0x3F 0x25 0x66 0x20 0x25 0x66 0x20 0x25 0x73 0x20 0x68 0x20 0x25 0x73 0x20 0x2E 0x3F 0x2E 0x20 0x20 0x20 0x20 0x58 0xFF 0x24 0x24
- **Length**: 48 bytes
- **Usage**: All IPF files use this static password

## File I/O Behavior

### Input Processing
- **Memory Mapping**: Uses CreateFileMappingA + MapViewOfFile for efficient file access
- **Reading Strategy**: Memory-mapped file I/O for performance
- **Validation**: Checks all three ZIP signatures before processing

### Output Processing
- **Output Format**: Standard ZIP file (no encryption)
- **Filenames**: Decrypted filenames written to ZIP headers
- **File Data**: Copied byte-for-byte from IPF to ZIP
- **Structure**: Maintains original ZIP structure with decrypted filenames

### Processing Flow
1. **Validation Phase**:
   - Load IPF file into memory
   - Verify Local File Header signature
   - Verify Central Directory signature
   - Verify End of Central Directory signature

2. **Conversion Phase**:
   - Read encrypted filenames from local headers
   - Decrypt filenames using PKZIP cipher
   - Build new ZIP structure with plaintext filenames
   - Copy file data unchanged

3. **Output Phase**:
   - Write ZIP file with decrypted structure
   - Verify output validity
   - Report completion status

## Error Messages

### File Access Errors
- "error : ::CreateFile() failed."
- "error : ::CreateFileMapping() failed."
- "error : ::MapViewOfFile() failed."
- "error : ::CopyFile() failed."

### IPF/ZIP Structure Errors
- "error : invalid ipf file."
- "error : invalid zip file."
- "error : unknown signature."
- "error : invalid local item."
- "error : invalid central item."
- "error : invalid central info."

### User Messages
- "processing completed successfully."
- "processing is loading the file..."
- "processing is saving the file..."
- "central : %s (%d/%d)" (Progress message)

### Command Line Errors
- "error : invalid args."
- "error : unknown."

## Critical Format Details Discovered

### IPF File Format
- **Structure**: Standard ZIP archive with encrypted filenames
- **Encryption**: Only filenames encrypted, file data is plaintext
- **Password**: Static 48-byte password across all IPF files
- **Compatibility**: Must preserve exact ZIP structure for game clients

### Filename Encryption
- **Location**: Encrypted filenames in local file headers (offset 30)
- **Length**: Variable length specified in header (offset 26)
- **Algorithm**: PKZIP stream cipher (ZIP specification APPNOTE V.6.3.6)
- **Purpose**: Prevent casual inspection of archive contents

### Header Structure Preservation
iz.exe preserves all ZIP header fields except:
- **Filenames**: Decrypts encrypted filenames to plaintext
- **General Purpose Flags**: May modify encryption bit
- **All other fields**: Copy unchanged from IPF to ZIP

## Processing Characteristics

### Memory Usage
- **Memory-Mapped I/O**: Maps entire file into memory for fast access
- **Streaming**: Processes files sequentially without loading all data
- **Efficiency**: Minimal memory overhead beyond file mapping

### Performance
- **Single-Threaded**: Original tool processes files sequentially
- **I/O Bound**: Limited by disk speed for large archives
- **Optimization Opportunity**: Our implementation uses multi-threading for parallel extraction

### Validation Strategy
- **Three-Signature Check**: Validates all ZIP format signatures
- **Structure Verification**: Ensures valid header sizes and offsets
- **Fail-Fast**: Reports errors immediately upon detection

## Implementation Notes

**Design Decision**: iz.exe converts IPF files to standard ZIP format by decrypting filenames. This two-step approach (IPF→ZIP) was originally used because standard ZIP tools couldn't handle encrypted filenames.

**Important Notes**:
- **Password Storage**: The 48-byte password is stored as ASCII string "?%f %f %s h %s .?.   X" which represents the raw bytes
- **Cipher Implementation**: Uses standard PKZIP stream cipher with CRC32 table lookups
- **No File Data Encryption**: Only filenames are encrypted in IPF files, not file contents
- **ZIP Compatibility**: Output is standard ZIP readable by any ZIP utility

**Future Improvements**:
- Our ipf-extractor combines iz.exe + ez.exe functionality into a single tool
- Eliminates intermediate ZIP file by extracting directly from IPF
- Adds multi-threading for parallel filename decryption and file extraction
- Provides single-pass extraction (theoretically 2x faster)

For compatibility testing, iz.exe output serves as reference validation for our tools.
