# ez.exe Reverse Engineering Analysis

## Binary Structure

- **File Type**: PE32 executable for MS Windows 4.00 (console), Intel i386
- **Size**: 37,888 bytes (37 KB)
- **Sections**: .text, .rdata, .data
- **Entry Point**: 0x00400400
- **Compiled**: Tue Jun 17 06:07:36 2014 UTC
- **Language**: MSVC

## Imported Functions

### KERNEL32.dll
- CreateFileA
- WriteFile
- CloseHandle
- GetCurrentDirectoryA
- GlobalAlloc
- GlobalFree
- lstrcatA
- lstrcpyA
- lstrcmpiA

### imagehlp.dll
- MakeSureDirectoryPathExists

### MSVCP60.dll
- ??1?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@QAE@XZ
- ??Hstd@@YA?AV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@0@ABV10@PBD@Z
- ?_Grow@?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@AAE_NI_N@Z
- ?_Tidy@?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@AAEX_N@Z
- ?_C@?1??_Nullstr@?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@CAPBDXZ@4DB

### SHLWAPI.dll
- PathCombineA
- PathRemoveExtensionA
- PathFindExtensionA

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
- _controlfp
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
- ??1type_info@@UAE@XZ
- _XcptFilter

## Key Functions

### fcn.00400400 (Entry Point)
- **Size**: Entry point at code section start
- **Purpose**: Main entry wrapper

### Unzip Function (ZIP Extraction)
- **Purpose**: Extracts files from ZIP archives using IPF password
- **Operations**:
  - Opens ZIP file using password-based decryption
  - Validates ZIP structure
  - Extracts files to target directory
  - Reports progress and errors

### Directory Management Functions
- **MakeSureDirectoryPathExists**: Creates directory structure if needed
- **PathCombineA**: Constructs full file paths
- **PathRemoveExtensionA**: Removes file extensions for path manipulation
- **GetCurrentDirectoryA**: Gets current working directory

## ZIP Libraries

### unzip Library
- **Version**: unzip 1.01
- **Copyright**: Gilles Vollant (1998-2004)
- **URL**: http://www.winimage.com/zLibDll
- **Purpose**: ZIP file format handling and extraction

### inflate Library
- **Version**: 1.2.8
- **Copyright**: Mark Adler (1995-2013)
- **Purpose**: Deflate decompression for compressed file data

## Password Storage

### Static IPF Password
- **Location**: Offset 0x5d10 in .rdata section
- **Storage**: ASCII string representation of bytes
- **String**: "?%f %f %s h %s .?.   X"
- **Bytes**: 0x25 0x66 0x20 0x25 0x66 0x20 0x25 0x73 0x20 0x25 0x73 0x20 0xFF 0xFF 0xFF 0xFF 0x3F 0x5B 0x20 0xFF 0xFF 0xFF 0xFF 0x3F 0x25 0x66 0x20 0x25 0x66 0x20 0x25 0x73 0x20 0x68 0x20 0x25 0x73 0x20 0x2E 0x3F 0x2E 0x20 0x20 0x20 0x20 0x58 0xFF 0x24 0x24
- **Length**: 48 bytes
- **Usage**: Password for decrypting ZIP files created by iz.exe

## Memory Structure

### Section Layout
- **.text**: 0x56a2 bytes (22,178 bytes) - Code section
- **.rdata**: 0x321c bytes (12,828 bytes) - Read-only data
- **.data**: 0x3b4 bytes (948 bytes) - Read/write data

### Data Storage
- **Password**: 48 bytes at offset 0x5d10
- **String Tables**: C++ std::string objects (MSVCP60.dll)
- **Path Buffers**: File and directory path storage

## File I/O Behavior

### Input Processing
- **File Access**: Uses stdio (fopen, fread, fclose) for ZIP file access
- **Validation**: Checks ZIP file structure before extraction
- **Password Usage**: Uses stored 48-byte password for decryption

### Output Processing
- **Directory Creation**: Uses MakeSureDirectoryPathExists for recursive directory creation
- **File Extraction**: Extracts files to specified target directory
- **Path Handling**: Uses SHLWAPI for robust path manipulation

### Processing Flow
1. **Initialization Phase**:
   - Parse command line arguments
   - Get current directory
   - Validate ZIP file

2. **Extraction Phase**:
   - Open ZIP file with IPF password
   - Read central directory
   - Extract each file to target directory
   - Create directories as needed

3. **Completion Phase**:
   - Close ZIP file
   - Report success or errors
   - Clean up resources

## Error Messages

### ZIP File Errors
- "error : Unzip() failed."
- "error : invalid zip file."

### File Operation Errors
- "file error"
- "data error"
- "buffer error"
- "stream error"

### Command Line Errors
- "error : invalid args."
- "error : unknown."

### Progress Messages
- "processing completed successfully."
- "target directory = %s"

### Library Messages
- "unzip 1.01 Copyright 1998-2004 Gilles Vollant - http://www.winimage.com/zLibDll"
- "inflate 1.2.8 Copyright 1995-2013 Mark Adler"

## Critical Format Details Discovered

### ZIP File Support
ez.exe is a ZIP extraction tool, not just a password display utility:

**Functionality**:
- Opens ZIP files using password-based decryption
- Validates ZIP structure (headers, signatures)
- Extracts files to target directory
- Handles compressed (deflate) and uncompressed files
- Creates directory structure automatically

**Password Usage**:
- Stored 48-byte password used for ZIP decryption
- Applied to encrypted ZIP entries
- Required for ZIP files created by iz.exe

### ZIP Library Integration
ez.exe uses industry-standard ZIP libraries:

**unzip 1.01**:
- Provides ZIP file parsing
- Handles central directory reading
- Manages file extraction
- Supports password-based decryption

**inflate 1.2.8**:
- Deflate decompression implementation
- Handles compressed file data
- Industry-standard algorithm (zlib)
- Robust error handling

### Directory Management
ez.exe includes sophisticated directory handling:

**Path Operations**:
- PathCombineA: Constructs safe paths
- PathRemoveExtensionA: Manipulates file paths
- GetCurrentDirectoryA: Gets working directory
- MakeSureDirectoryPathExists: Creates full directory tree

**Safety Features**:
- Automatic directory creation
- Path sanitization
- Current directory awareness
- Recursive directory structure support

## Processing Characteristics

### Memory Usage
- **C++ Strings**: Uses MSVCP60.dll std::string for path handling
- **Buffering**: Uses stdio buffering for efficient I/O
- **Minimal Overhead**: Only loads needed data into memory

### Performance
- **Single-Threaded**: Processes files sequentially
- **Standard Libraries**: Uses unzip/inflate libraries for efficiency
- **I/O Bound**: Limited by disk speed for large archives
- **Optimization Opportunity**: Our implementation uses multi-threading

### Validation Strategy
- **ZIP Structure**: Validates file format before extraction
- **Error Reporting**: Clear error messages for failures
- **Library Integration**: Leverages mature unzip/inflate libraries

## Implementation Notes

**Design Decision**: ez.exe is a ZIP extraction tool that uses the IPF password. Combined with iz.exe, it provides complete IPF extraction workflow:
- iz.exe: IPF (encrypted filenames) → ZIP (decrypted filenames)
- ez.exe: ZIP (with password) → Extracted files

**Important Notes**:
- **Password Purpose**: The 48-byte password is used for ZIP decryption, not displayed to stdout
- **ZIP Format**: Standard ZIP files with encrypted entries (password-protected)
- **Library Dependence**: Uses third-party unzip and inflate libraries
- **Directory Safety**: Includes robust directory creation and path handling

**Workflow**:
1. iz.exe converts IPF to ZIP (decrypts filenames)
2. ez.exe extracts ZIP to files using password
3. Final result: All game files extracted from IPF archive

**Future Improvements**:
- Our ipf-extractor combines iz.exe + ez.exe into a single tool
- Eliminates intermediate ZIP file (direct IPF → files)
- Adds multi-threading for parallel extraction
- Simplifies workflow with one command instead of two
- Provides single-pass extraction (theoretically 2x faster)

**Library Versions**:
- unzip 1.01: Well-established ZIP library
- inflate 1.2.8: Standard deflate implementation (same as zlib 1.2.8)
- MSVCP60.dll: Microsoft Visual C++ runtime (C++ 6.0)

For compatibility testing, ez.exe output serves as reference validation for our tools.
