# cz.exe Reverse Engineering Analysis

## Binary Structure

- **File Type**: PE32 executable for MS Windows 4.00 (console), Intel i386
- **Size**: 45KB (45,056 bytes)
- **Sections**: .text, .rdata, .data
- **Entry Point**: 0x00400400
- **Compiled**: Mon Jun 16 16:35:53 2014 UTC
- **Language**: C

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
- lstrcatA
- lstrlenA

### MSVCRT.dll
- fopen
- fread
- fwrite
- ftell
- fseek
- fclose
- malloc
- free
- printf
- rand
- srand
- time
- localtime
- _controlfp
- exit
- __getmainargs
- _initterm
- __set_app_type
- __p__fmode
- __p__commode
- __p___initenv

### SHLWAPI.dll
- PathAddBackslashA
- PathCombineA
- PathCanonicalizeA

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

## Key Functions

### fcn.00400400 (Entry Point)
- **Size**: Entry point at code section start
- **Purpose**: Main entry wrapper

### Directory Traversal Functions
- **Purpose**: Scan folder structure recursively
- **Operations**:
  - FindFirstFileA: Start directory enumeration
  - FindNextFileA: Iterate through directory entries
  - PathCombineA: Construct full file paths
  - PathCanonicalizeA: Normalize paths

### ZIP Creation Functions
- **Purpose**: Create ZIP file structure
- **Operations**:
  - zipOpen: Create new ZIP file
  - zipOpenNewFileInZip3: Add file entry to ZIP
  - WriteFile: Read source file data
  - fwrite: Write compressed data to ZIP
  - zipCloseFile: Finalize current file entry
  - zipClose: Finalize ZIP archive

## Password Storage

### Static IPF Password
- **Location**: Offset 0x08000 in .rdata section
- **Storage**: ASCII string "?%f %f %s h %s .?.   X"
- **Bytes**: 0x25 0x66 0x20 0x25 0x66 0x20 0x25 0x73 0x20 0x25 0x73 0x20 0xFF 0xFF 0xFF 0xFF 0x3F 0x5B 0x20 0xFF 0xFF 0xFF 0xFF 0x3F 0x25 0x66 0x20 0x25 0x66 0x20 0x25 0x73 0x20 0x68 0x20 0x25 0x73 0x20 0x2E 0x3F 0x2E 0x20 0x20 0x20 0x20 0x58 0xFF 0x24 0x24
- **Length**: 48 bytes
- **Usage**: Password for encrypting ZIP filenames (used by zi.exe)

## Memory Structure

### Section Layout
- **.text**: 0x74c2 bytes (29,890 bytes) - Code section
- **.rdata**: 0x31fa bytes (12,794 bytes) - Read-only data
- **.data**: 0x228 bytes (552 bytes) - Read/write data

### Data Storage
- **Password**: 48 bytes at offset 0x08000
- **Path Buffers**: File and directory path storage
- **Directory State**: Current directory traversal context
- **Compression Buffers**: Temporary buffers for deflate compression

## File I/O Behavior

### Input Processing
- **Directory Traversal**: Uses FindFirstFileA/FindNextFileA for recursive scanning
- **File Reading**: Uses ReadFile for source file data
- **Path Handling**: Uses SHLWAPI for robust path manipulation

### Output Processing
- **ZIP Creation**: Uses zip library functions for ZIP structure
- **Compression**: Uses deflate 1.2.8 for data compression
- **File Writing**: Uses fwrite for writing compressed ZIP data
- **Output Format**: Standard ZIP file (plaintext filenames, compressed data)

### Processing Flow
1. **Initialization Phase**:
   - Parse command line arguments
   - Initialize random seed (time)
   - Open output ZIP file

2. **Directory Traversal Phase**:
   - Recursively scan source directory
   - Build file list with metadata
   - Create directory structure paths

3. **Compression Phase**:
   - For each file:
     - Read file data
     - Compress using deflate
     - Add to ZIP with plaintext filename
     - Update progress

4. **Completion Phase**:
   - Write ZIP central directory
   - Write end of central directory
   - Close ZIP file
   - Report completion status

## Error Messages

### ZIP Operation Errors
- "error : zipOpen failed."
- "error : zipOpenNewFileInZip3 failed."

### Compression Errors
- "buffer error"
- "data error"
- "file error"
- "stream error"
- "incompatible version"

### Command Line Errors
- "error : invalid args."
- "error : unknown."

### Progress Messages
- "Processing is compressing %s to %s"
- "processing completed successfully."

## Critical Format Details Discovered

### ZIP File Creation
cz.exe creates standard ZIP files from folder contents:

**Functionality**:
- Creates ZIP file structure using zip 1.01 library
- Compresses file data using deflate 1.2.8
- Uses plaintext filenames (not encrypted yet)
- Supports directory structure preservation
- Handles both compressed and uncompressed files

**Password Storage**:
- Contains 48-byte IPF password but doesn't use it directly
- Password used by zi.exe to encrypt filenames after ZIP creation
- Stored as ASCII string "?%f %f %s h %s .?.   X"

### ZIP Library Integration
cz.exe uses industry-standard ZIP libraries:

**zip 1.01**:
- Provides ZIP file creation API
- Manages central directory structure
- Handles file entry management
- Supports standard ZIP format

**deflate 1.2.8**:
- Industry-standard compression (same as zlib 1.2.8)
- Efficient data compression
- Robust error handling
- Compatible with all ZIP utilities

### Directory Management
cz.exe includes sophisticated directory handling:

**Path Operations**:
- PathCombineA: Constructs safe paths
- PathCanonicalizeA: Normalizes path separators
- PathAddBackslashA: Ensures proper directory paths
- GetCurrentDirectoryA: Gets working directory

**Safety Features**:
- Recursive directory traversal
- Path sanitization
- Current directory awareness
- Full directory tree preservation

## Processing Characteristics

### Memory Usage
- **Path Buffers**: Uses SHLWAPI for path manipulation
- **Compression Buffers**: Temporary buffers for deflate
- **Directory State**: FindFirstFileA/FindNextFileA context
- **Random Seed**: Uses time() for initialization

### Performance
- **Single-Threaded**: Processes files sequentially
- **Standard Libraries**: Uses zip/deflate libraries for efficiency
- **I/O Bound**: Limited by disk speed for large directories
- **Optimization Opportunity**: Our implementation can use multi-threading

### Validation Strategy
- **ZIP Structure**: Validates ZIP file creation
- **Error Reporting**: Clear error messages for failures
- **Library Integration**: Leverages mature zip/deflate libraries

## Implementation Notes

**Design Decision**: cz.exe creates standard ZIP files from folder contents. The ZIP files created by cz.exe have plaintext filenames (not encrypted). zi.exe is then used to encrypt the filenames and convert to IPF format.

**Workflow**:
1. cz.exe: Folder → ZIP (plaintext filenames, compressed data)
2. zi.exe: ZIP (plaintext) → IPF (encrypted filenames)

**Important Notes**:
- **Password Storage**: The 48-byte password is stored but not used for encryption in cz.exe
- **ZIP Format**: Standard ZIP files with deflate compression
- **Plaintext Filenames**: Filenames are NOT encrypted by cz.exe
- **Library Dependence**: Uses third-party zip and deflate libraries
- **Directory Safety**: Includes robust directory creation and path handling

**Future Improvements**:
- Our ipf-creator can combine cz.exe + zi.exe functionality:
  - Direct folder → IPF creation
  - Encrypt filenames during creation
  - Add multi-threading for parallel compression
  - Simplify workflow with one command instead of two
  - Eliminate intermediate ZIP file

**Library Versions**:
- zip 1.01: Well-established ZIP library
- deflate 1.2.8: Standard deflate implementation (same as zlib 1.2.8)

For compatibility testing, cz.exe output serves as intermediate format validation for our tools.
