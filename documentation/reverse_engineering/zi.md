# zi.exe Reverse Engineering Analysis

## Binary Structure

- **File Type**: PE32 executable for MS Windows 4.00 (console), Intel i386
- **Size**: 19KB (19,456 bytes)
- **Sections**: .text, .rdata, .data
- **Entry Point**: 0x00400400
- **Compiled**: Mon Apr 14 10:35:15 2014 UTC
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
- lstrcatA
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

## Key Functions

### fcn.00400400 (Entry Wrapper)
- **Size**: Entry point at code section start
- **Purpose**: Main entry wrapper

### fcn.00401ba7 (Central Directory Validation)
- **Size**: ~200 bytes
- **Purpose**: Validates ZIP central directory signature
- **Operations**:
  - Compares against 0x02014b50 (Central Directory signature)
  - Allocates 74 bytes for directory entry
  - Validates directory structure

### fcn.00401c32 (End of Central Directory Validation)
- **Size**: ~200 bytes
- **Purpose**: Validates ZIP end of central directory signature
- **Operations**:
  - Compares against 0x06054b50 (End of Central Directory signature)
  - Allocates 34 bytes for end record
  - Validates end record structure

### fcn.004027ca (ZIP Cipher Key Initialization)
- **Size**: ~50 bytes
- **Purpose**: Initializes PKZIP stream cipher encryption keys
- **Operations**:
  - Sets key1 = 0x12345678
  - Sets key2 = 0x23456789
  - Sets key3 = 0x34567890

## ZIP Signature Checks

Two ZIP format signatures verified:

1. **Central Directory**: 0x02014b50 at address 0x00401ba7
2. **End of Central Directory**: 0x06054b50 at address 0x00401c32

**Note**: Does NOT check Local File Header signature (0x04034b50) - assumes valid ZIP input

## Memory Structure

### Section Layout
- **.text**: 0x1aea bytes (6,858 bytes) - Code section
- **.rdata**: 0x2622 bytes (9,794 bytes) - Read-only data
- **.data**: 0x270 bytes (624 bytes) - Read/write data

### Data Structures
- **Central Directory Entries**: 74-byte structures
- **End of Central Directory**: 34-byte structure
- **Encryption Keys**: 12 bytes (three 4-byte keys)
- **CRC32 Table**: 256 entries at offset 0x03090 in .rdata section
- **Memory Mapping**: Uses MapViewOfFile for file access

## Filename Encryption Algorithm

- **Encryption**: PKZIP stream cipher (ZIP specification APPNOTE V.6.3.6)
- **Key Initialization**: 0x12345678, 0x23456789, 0x34567890
- **Key Update**: CRC32-based updates using lookup table
- **Encryption**: XOR plaintext filename with cipher byte, then update keys

## IPF Password

- **Location**: Offset 0x04000 in .rdata section
- **Storage**: ASCII string "?%f %f %s h %s .?.   X"
- **Bytes**: 48 bytes (0x25 0x66 0x20 0x25 0x66 0x20 0x25 0x73 0x20 0x25 0x73 0x20 0xFF 0xFF 0xFF 0xFF 0x3F 0x5B 0x20 0xFF 0xFF 0xFF 0xFF 0x3F 0x25 0x66 0x20 0x25 0x66 0x20 0x25 0x73 0x20 0x68 0x20 0x25 0x73 0x20 0x2E 0x3F 0x2E 0x20 0x20 0x20 0x20 0x58 0xFF 0x24 0x24)
- **Usage**: Static password used across all IPF files

## File I/O Behavior

- **Mode**: Memory-mapped I/O (CreateFileMappingA + MapViewOfFile)
- **Conversion**: ZIP (plaintext filenames) → IPF (encrypted filenames)
- **File Data**: Copied byte-for-byte without modification
- **Output**: IPF file with encrypted filenames, compressed data unchanged

### Processing Flow
1. **Validation Phase**:
   - Load ZIP file into memory
   - Verify Central Directory signature
   - Verify End of Central Directory signature

2. **Encryption Phase**:
   - Read plaintext filenames from ZIP headers
   - Encrypt filenames using PKZIP cipher
   - Rebuild ZIP structure with encrypted filenames
   - Copy all file data unchanged

3. **Output Phase**:
   - Write IPF file with encrypted structure
   - Verify output validity
   - Report completion status

## Error Messages

### File Access Errors
- "error : ::CreateFile() failed."
- "error : ::CreateFileMapping() failed."
- "error : ::MapViewOfFile() failed."
- "error : ::CopyFile() failed."

### ZIP Structure Errors
- "error : invalid zip file."
- "error : invalid central info."
- "error : invalid central item."
- "error : invalid local item."
- "error : unknown signature."

### User Messages
- "processing completed successfully."
- "processing is loading the file..."
- "processing is saving the file..."
- "central : %s (%d/%d)" (Progress message)

### Command Line Errors
- "error : invalid args."
- "error : unknown."

## Critical Format Details Discovered

### ZIP to IPF Conversion
zi.exe converts standard ZIP files to IPF format:

**Functionality**:
- Reads ZIP file structure (assumes valid ZIP input)
- Encrypts plaintext filenames using PKZIP cipher
- Copies all file data unchanged (compression preserved)
- Rebuilds ZIP structure with encrypted filenames
- Outputs IPF file (ZIP with encrypted headers)

**Key Difference from iz.exe**:
- iz.exe: Decrypts IPF filenames → plaintext ZIP
- zi.exe: Encrypts plaintext ZIP filenames → IPF

### Filename Encryption
- **Location**: Encrypts filenames in local file headers (offset 30)
- **Length**: Variable length specified in header (offset 26)
- **Algorithm**: PKZIP stream cipher with CRC32 table lookups
- **Purpose**: Convert plaintext filenames to encrypted IPF format

### Header Structure Transformation
zi.exe modifies ZIP header structure:
- **Filenames**: Encrypts plaintext filenames to ciphertext
- **Local File Headers**: Rewrite with encrypted filenames
- **Central Directory**: Rewrite with encrypted filenames
- **File Data**: Copy byte-for-byte (no changes)
- **Compression**: Preserve original compression method

## Implementation Notes

**Design Decision**: zi.exe converts standard ZIP files (from cz.exe) to IPF format by encrypting filenames. This completes the IPF creation workflow: folder → ZIP (cz.exe) → IPF (zi.exe).

**Workflow**:
1. cz.exe: Folder → ZIP (plaintext filenames, compressed data)
2. zi.exe: ZIP (plaintext) → IPF (encrypted filenames)

**Important Notes**:
- **Inverse of iz.exe**: zi.exe encrypts, iz.exe decrypts (same cipher)
- **Input Assumption**: Assumes valid ZIP input (no Local File Header check)
- **Data Preservation**: File data is copied byte-for-byte, not modified
- **Password Usage**: Uses same 48-byte password as iz.exe and ez.exe
- **Format Preservation**: Compression method, timestamps, and file attributes preserved

**Future Improvements**:
- Our ipf-creator can combine cz.exe + zi.exe functionality:
  - Direct folder → IPF creation
  - Encrypt filenames during creation (no intermediate ZIP)
  - Add multi-threading for parallel compression and encryption
  - Simplify workflow with one command instead of two
  - Eliminate intermediate ZIP file (theoretically 2x faster)

**Cipher Details**:
- Same PKZIP stream cipher as iz.exe
- Same 48-byte password
- Same CRC32 table
- Same key initialization values

For compatibility testing, zi.exe output serves as reference validation for our tools.
