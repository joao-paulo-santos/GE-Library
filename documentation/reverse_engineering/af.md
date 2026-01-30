# af.exe Reverse Engineering Analysis

## Binary Structure

- **File Type**: PE32 executable for MS Windows 4.00 (console), Intel i386
- **Size**: 44KB (44,032 bytes)
- **Sections**: .text, .rdata, .data
- **Compiled**: Oct 18 2014

## Imported Functions

### KERNEL32.dll
- FindFirstFileA
- FindNextFileA
- FindClose
- CloseHandle
- CreateFileA
- ReadFile
- GlobalAlloc
- GlobalFree
- GetCurrentDirectoryA
- lstrcpyA
- lstrlenA

### MSVCRT.dll
- fopen
- fread
- fwrite
- ftell
- fseek
- fclose
- free
- malloc
- rand
- srand
- time
- localtime
- printf
- exit
- _controlfp
- __getmainargs
- _initterm
- __p__fmode
- __p__commode
- __p___initenv

### SHLWAPI.dll
- PathAddBackslashA
- PathCanonicalizeA
- PathCombineA

## ZIP Libraries

### zip Library
- **Version**: zip 1.01
- **Copyright**: Gilles Vollant (1998-2004)
- **URL**: http://www.winimage.com/zLibDll
- **Purpose**: ZIP file creation and management

### deflate Library
- **Version**: 1.2.8
- **Copyright**: Jean-loup Gailly and Mark Adler (1995-2013)
- **Purpose**: Deflate compression for file data

## File I/O Behavior

### Input Processing
- **IPF Reading**: Uses ReadFile to read existing IPF file content
- **Folder Traversal**: Uses FindFirstFileA/FindNextFileA for new folder scanning
- **Path Handling**: Uses SHLWAPI for robust path manipulation

### Output Processing
- **IPF Creation**: Uses zip library functions with fopen/fwrite for ZIP structure
- **Compression**: Uses deflate 1.2.8 for new file data compression
- **File Writing**: Uses fwrite for writing compressed IPF data
- **Output Format**: IPF file with encrypted filenames and compressed data

### Processing Flow
1. **Initialization Phase**:
   - Parse command line arguments
   - Validate IPF file can be opened
   - Initialize random seed (time)

2. **Existing IPF Reading Phase**:
   - Open existing IPF file
   - Read ZIP structure
   - Decrypt filenames using PKZIP cipher
   - Read existing file entries

3. **New Folder Traversal Phase**:
   - Recursively scan source directory
   - Build file list with metadata
   - Check for duplicate filenames with existing files

4. **IPF Creation Phase**:
   - Create new IPF file (not in-place)
   - Copy existing file entries (with their compressed data)
   - Compress and add new files from folder
   - Encrypt all filenames using PKZIP cipher

5. **Completion Phase**:
   - Write ZIP central directory
   - Write end of central directory
   - Close new IPF file
   - Replace original IPF with new file
   - Report completion status

## Error Messages

### File Access Errors
- "error : Specified ipf file cannot be opened ."
- "error : invalid args."
- "error : unknown."

### ZIP Operation Errors
- "error : zipOpenNewFileInZip3 failed."

### Compression Errors
- "buffer error"
- "data error"
- "stream error"
- "file error"
- "incompatible version"

### User Messages
- "Processing is compressing %s"
- "processing completed successfully."

## Memory Structure

### Section Layout
- **.text**: 0x753b bytes (30,011 bytes) - Code section
- **.rdata**: 0x31a2 bytes (12,706 bytes) - Read-only data
- **.data**: 0x238 bytes (568 bytes) - Read/write data

### Data Storage
- **Password**: 48-byte IPF password (for PKZIP encryption)
- **Path Buffers**: File and directory path storage
- **Directory State**: Current directory traversal context
- **Compression Buffers**: Temporary buffers for deflate compression
- **File Entry Array**: Existing IPF file entries

## ZIP/IPF Format Details

### IPF File Creation
af.exe creates IPF files by combining existing and new content:

**Existing Files**:
- Copy local file headers (with encrypted filenames)
- Copy compressed data byte-for-byte
- Copy central directory entries
- Preserve all timestamps and metadata

**New Files**:
- Create local file headers
- Encrypt filenames using PKZIP cipher with 48-byte password
- Compress data using deflate 1.2.8
- Create central directory entries
- Set timestamps from source files

**IPF Structure**:
- Standard ZIP format with encrypted filenames
- PKZIP cipher for filename encryption
- Deflate compression (method 8)
- GenPurpose flag: 0x0001 (encrypted filenames, no data descriptor)
- Version Made By: 0x0014 (ZIP 2.0)

### Directory Management
af.exe includes sophisticated directory handling:

**Path Operations**:
- PathCombineA: Constructs safe paths
- PathCanonicalizeA: Normalizes path separators
- PathAddBackslashA: Ensures proper directory paths
- GetCurrentDirectoryA: Gets working directory

**Duplicate Handling**:
- Checks for filename conflicts between existing and new files
- Likely overwrites existing files with new versions (similar to oz.exe keeping higher-indexed files)
- Maintains file order from original IPF with new files appended

## Processing Characteristics

### Memory Usage
- **Path Buffers**: Uses SHLWAPI for path manipulation
- **Compression Buffers**: Temporary buffers for deflate
- **Directory State**: FindFirstFileA/FindNextFileA context
- **File Entry Array**: Stores existing IPF file entries
- **Random Seed**: Uses time() for initialization

### Performance
- **Single-Threaded**: Processes files sequentially
- **Standard Libraries**: Uses zip/deflate libraries for efficiency
- **I/O Bound**: Limited by disk speed for large IPF files and directories
- **Memory**: Must load existing IPF structure into memory
- **New File Creation**: Creates complete new IPF file (not in-place)

### File I/O Strategy
- **New File Approach**: Creates new IPF file rather than modifying in-place
- **ZIP Library Limitation**: zip 1.01 library creates complete ZIP structures from scratch
- **Replacement**: Replaces original IPF file with new file after processing
- **Atomicity**: Ensures data integrity by creating complete new file before replacement

## Critical Format Details Discovered

### New File Creation vs In-Place Modification
af.exe uses a **new file creation** approach, not in-place modification:

**Evidence**:
- **File Mode Strings**: Contains "wb" (write binary) and "rb" (read binary) strings at 0x0040ac10, plus "r+b" (read/write binary)
- **ZIP Library**: Uses zip 1.01 library which creates complete ZIP files from scratch
- **Import Analysis**:
  - Imports `fopen`, `fwrite`, `fclose` from MSVCRT.dll for ZIP file creation
  - Does NOT import `WriteFile`, `SetFilePointer`, or `SetEndOfFile` from KERNEL32.dll
  - **Critical**: oz.exe (which does in-place modification) imports SetFilePointer and SetEndOfFile
  - Imports `CreateFileA` and `ReadFile` from KERNEL32.dll only for reading existing IPF files
  - **File Mode Usage**: Despite containing "r+b" string, af.exe uses "wb" mode for output (creates/truncates file)
- **File Access Patterns**: CreateFileA calls use GENERIC_READ (0x80000000) and OPEN_EXISTING (0x3) flags for reading input only

**Reasoning**:
- ZIP library (zip 1.01) doesn't support in-place modification
- Must create complete new ZIP structure with existing + new files
- fopen with "wb" mode creates new file (not in-place modification)
- Allows atomic operation (complete new file before replacing original)
- Ensures data integrity even if operation is interrupted

**Implications**:
- Requires enough disk space for duplicate IPF file during processing
- Ensures data integrity through atomic file replacement
- Allows recovery if operation is interrupted (original file exists until successful completion)

### IPF File Structure
af.exe maintains IPF format compatibility:

**Existing Files**:
- Copy local file headers byte-for-byte
- Copy compressed data without modification
- Preserve encrypted filenames
- Maintain all metadata (timestamps, CRC32, sizes)

**New Files**:
- Create new local file headers
- Encrypt filenames using PKZIP cipher with 48-byte password
- Compress data using deflate 1.2.8
- Calculate new CRC32 values
- Set timestamps from source files (converted to MS-DOS format)

**Combined Output**:
- Single IPF file with both existing and new files
- Consistent GenPurpose flags (0x0001)
- Consistent Version Made By (0x0014)
- Proper central directory with all entries
- Correct end of central directory record

### GenPurpose and Version Made By
Based on cz.exe analysis and typical IPF files:

**GenPurpose Flag**:
- **Likely Value**: 0x0001 (bit 0 = encrypted filenames)
- **Different from oz.exe**: oz.exe uses 0x0009 (includes data descriptor flag)
- **Reason**: af.exe creates new IPF files, doesn't need data descriptors

**Version Made By**:
- **Likely Value**: 0x0014 (ZIP 2.0)
- **Consistency**: Matches cz.exe and typical IPF files
- **Note**: oz.exe also uses 0x0014 in optimized IPF files

**Important**: Actual values can only be confirmed by testing af.exe output against reference IPF files.

### GenPurpose and Version Made By
Based on cz.exe analysis and typical IPF files:

**GenPurpose Flag**:
- **Likely Value**: 0x0001 (bit 0 = encrypted filenames)
- **Different from oz.exe**: oz.exe uses 0x0009 (includes data descriptor flag)
- **Reason**: af.exe creates new IPF files, doesn't need data descriptors

**Version Made By**:
- **Likely Value**: 0x0014 (ZIP 2.0)
- **Consistency**: Matches cz.exe and typical IPF files
- **Note**: oz.exe also uses 0x0014 in optimized IPF files

**Important**: Actual values can only be confirmed by testing af.exe output against reference IPF files.
