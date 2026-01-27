# IPF Format Documentation

## Overview

IPF files are ZIP archives with encrypted filenames and a static password. The format closely follows standard ZIP specifications but has several variations that must be preserved for compatibility.

## File Structure

```
[File Data (ZIP)]
[Central Directory]
[End of Central Directory]
```

## Local File Header

Standard 30-byte header followed by encrypted filename and optional extra field:

| Offset | Size | Field | Description |
|--------|------|--------|-------------|
| 0 | 4 | Signature | `0x04034b50` |
| 4 | 2 | Version Needed | Version needed to extract |
| 6 | 2 | General Purpose Flags | See flags below |
| 8 | 2 | Compression Method | Usually `0x0008` (deflate) |
| 10 | 2 | Modified Time | MS-DOS time format |
| 12 | 2 | Modified Date | MS-DOS date format |
| 14 | 4 | CRC32 | CRC-32 of uncompressed data |
| 18 | 4 | Compressed Size | Size of compressed file |
| 22 | 4 | Uncompressed Size | Size of uncompressed file |
| 26 | 2 | Filename Length | Length of encrypted filename |
| 28 | 2 | Extra Field Length | Length of extra field data |
| 30 | N | Encrypted Filename | PKZIP encrypted filename bytes |
| 30+N | M | Extra Field | Optional extra field data |

Total local file header size: `30 + N + M` bytes

### General Purpose Flags

| Bit | Value | Description |
|------|--------|-------------|
| 0 | 0x0001 | Encrypted (always set for IPF) |
| 3 | 0x0008 | Data descriptor flag (oz.exe sets this) |

**Important**: oz.exe writes `0x0009` (bits 0 and 3 set) in optimized IPFs. Original IPFs typically have `0x0001` (only bit 0).

## Encrypted Filename

- **Encryption**: PKZIP stream cipher (ZIP specification APPNOTE V.6.3.6)
- **Password**: Static 48-byte password (see below)
- **Decryption**: Required to access actual filenames

**Password**:
```
0x25 0x66 0x20 0x25 0x66 0x20 0x25 0x73 0x20 0x25 0x73
0xFF 0xFF 0xFF 0xFF 0x3F 0x5B 0x20 0xFF 0xFF 0xFF 0xFF
0x3F 0x25 0x66 0x20 0x25 0x66 0x20 0x25 0x73 0x20
0x68 0x20 0x25 0x73 0x20 0x2E 0x3F 0x20 0x20 0x20 0x20
0x58 0xFF 0x24 0x24
```

## Central Directory Header

46-byte header for each file:

| Offset | Size | Field | Description |
|--------|------|--------|-------------|
| 0 | 4 | Signature | `0x02014b50` |
| 4 | 2 | Version Made By | **CRITICAL**: oz.exe writes `0x0014` (ZIP 2.0) even when original has `0x0000` |
| 6 | 2 | Version Needed | Version needed to extract |
 | 8 | 2 | General Purpose Flags | **CRITICAL**: oz.exe writes `0x0009` (must match local headers) |
| 10 | 2 | Compression Method | Compression method |
| 12 | 2 | Modified Time | MS-DOS time |
| 14 | 2 | Modified Date | MS-DOS date |
| 16 | 4 | CRC32 | CRC-32 of uncompressed data |
| 20 | 4 | Compressed Size | Size of compressed file |
| 24 | 4 | Uncompressed Size | Size of uncompressed file |
| 28 | 2 | Filename Length | Length of encrypted filename |
| 30 | 2 | Extra Field Length | Length of extra field |
| 32 | 2 | Comment Length | Length of file comment (always 0) |
| 34 | 2 | Disk Number Start | Disk where file starts |
| 36 | 2 | Internal File Attributes | Internal attributes (always 0) |
| 38 | 2 | External File Attributes | External attributes (always 0) |
| 40 | 4 | Local Header Offset | Offset of local file header |
| 44 | 2 | Extra Field Offset | Offset of extra field (if exists) |

### Version Made By Field

**CRITICAL DISCOVERY**:

- **Original IPFs**: Typically have `0x0000` (ZIP version 0.0)
- **oz.exe Optimized IPFs**: Always have `0x0014` (ZIP version 2.0)

**Note**: The version that **created the archive**, not the version needed to extract. Our optimizer must preserve the value from the original IPF but oz.exe always writes `0x0014` when optimizing.

## End of Central Directory

22-byte end record:

| Offset | Size | Field | Description |
|--------|------|--------|-------------|
| 0 | 4 | Signature | `0x06054b50` |
| 4 | 2 | Disk Number | Number of disk (always 0) |
| 6 | 2 | CD Disk Start | Disk where CD starts (always 0) |
| 8 | 2 | Disk Entries | Number of entries on this disk |
| 10 | 2 | Total Entries | Total number of entries |
| 12 | 4 | CD Size | Size of central directory |
| 16 | 4 | CD Offset | Offset of central directory |
| 20 | 2 | Comment Length | Length of comment (always 0) |

## File Count Considerations

When reading IPF structure, different tools may report different file counts:

1. **Central Directory Entry Count**: Number of entries in central directory (authoritative)
2. **Local File Header Count**: Number of actual file data entries
3. **ZIP Reader Library**: May interpret ZIP structure differently

**Important**: The central directory count is the authoritative count of files. Some files may have only a central directory entry without corresponding data (unlikely but possible in malformed archives).

## Progressive Bloat

Granado Espada's IPF system suffers from progressive file bloat:

### How Bloat Accumulates

1. **Initial IPFs**: Contain original game files
2. **Game Patches**: Add new files to existing IPFs
3. **File Retention**: Old files remain even when overridden by newer versions
4. **Archive Growth**: IPFs continuously increase in size with each update

### Impact

- **Duplicate Files**: Multiple versions of the same file exist within single IPFs
- **Wasted Storage**: Archives contain obsolete file versions
- **Slower Extraction**: More files to process even for unchanged content
- **Inefficient Transfers**: Users download bloated archives with redundant data

### Optimization

The optimizer removes duplicate file versions by:
1. Identifying files with identical filenames
2. Keeping only the highest-indexed version (newest)
3. Removing all obsolete duplicate entries
4. Rebuilding ZIP structure preserving format quirks

### Version Selection

- **Rule**: Higher index = Newer version
- **Rationale**: Game patchers append new files at the end of archives
- **Implementation**: Keep file with higher `Index` when duplicates found

## Compatibility Requirements

For byte-for-byte compatibility with oz.exe:

1. **GenPurpose Flag**: Must be `0x0009` (encrypted + data descriptor) in optimized IPFs
2. **Version Made By**: Must be `0x0014` (ZIP 2.0) in central directory
3. **File Order**: Must preserve original index order of retained files
4. **Encrypted Data**: Copy byte-for-byte without re-encryption
5. **ZIP Structure**: Standard format with above variations

## Tools Summary

| Tool | Function | Notes |
|-------|-----------|--------|
| iz.exe | Extract IPF → ZIP | Decrypts filenames, creates temporary ZIP |
| ez.exe | Extract password | Reads IPF and outputs password to stdout |
| oz.exe | Optimize IPF | Removes duplicates, modifies IPF in-place |

## References

- [ZIP File Format Specification](https://pkware.cachefly.com/webdocs/casestudies/APPNOTE.TXT) (PKZIP encryption)
- [AppNote V.6.3.6](https://pkware.cachefly.com/webdocs/APPNOTE.6.3.6.TXT)
- oz.exe Reverse Engineering: `documentation/reverse_engineering/oz.md`
