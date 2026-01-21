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
