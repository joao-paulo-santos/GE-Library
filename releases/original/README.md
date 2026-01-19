# Original Windows Tools

This directory contains the proprietary Windows IPF tools from Granado Espada that we use for reference validation.

## Available Tools

| Tool | Purpose | Implemented |
|-------|---------|-------------|
| `iz.exe` | IPF to ZIP converter (extraction step 1) | ✅ |
| `ez.exe` | ZIP extractor (extraction step 2) | ✅ |
| `cz.exe` | Folder to ZIP converter (creation step 1) | ⏳ Planned |
| `zi.exe` | ZIP to IPF converter (creation step 2) | ⏳ Planned |
| `oz.exe` | IPF optimizer | ⏳ Planned |
| `af.exe` | Add folder to IPF | ⏳ Planned |
| `ix3.exe` | IES to XML/PRN converter | ⏳ Planned |

## Tool Usage Patterns

### Extract IPF File

**Process:** IPF → ZIP → Extracted Files

**Commands:**
```bash
# Step 1: Convert IPF to ZIP (creates .zip in same directory as IPF)
wine bin/iz.exe <ipf_file.ipf>

# Step 2: Extract ZIP to directory
wine bin/ez.exe <path/to/zip_file.zip>

# Step 3: Delete ZIP file
rm <path/to/zip_file.zip>
```

**Example:**
```bash
cd releases/original
wine bin/iz.exe ai.ipf
wine bin/ez.exe ai.zip
rm ai.zip
```

**Output:** Files extracted to directory named after IPF (e.g., `ai/` for `ai.ipf`)

**Important Notes:**
- `iz.exe` **always creates ZIP in the same directory as the IPF file**
- Run `iz.exe` from the directory containing the IPF file
- `ez.exe` extracts ZIP to a directory named after the ZIP filename (without .zip extension)

### Create IPF From Folder

**Process:** Folder → ZIP → IPF

**Commands:**
```bash
# Step 1: Convert folder to ZIP
wine bin/cz.exe <folder_path>

# Step 2: Convert ZIP to IPF
wine bin/zi.exe <zip_file.zip>

# Step 3: Delete ZIP file
rm <zip_file.zip>
```

**Example:**
```bash
wine bin/cz.exe ai/
wine bin/zi.exe ai.zip
rm ai.zip
```

### Optimize IPF

**Process:** IPF → Optimized IPF

**Command:**
```bash
wine bin/oz.exe <ipf_file.ipf>
```

### Add Folder to IPF

**Process:** IPF + Folder → Updated IPF

**Command:**
```bash
wine bin/af.exe <ipf_file.ipf> <folder_path>
```

### Convert IES to XML/PRN

**Process:** IES → CSV/PRN

**Command:**
```bash
wine bin/ix3.exe <ies_file.ies>
```

## Known Issues

### 1. Output Location
- `iz.exe` creates ZIP in **same directory as input IPF file**
- Not configurable via command line
- Must run from directory containing IPF files

### 2. Extraction Directory
- `ez.exe` creates directory named after ZIP filename (without .zip)
- Always extracts to current working directory
- Not configurable via command line

### 3. Wine Compatibility
- Requires Wine on Linux/macOS
- May have Wine-specific warnings (ignoreable)
- File permissions may differ from native Windows

### 4. No Progress Output
- Only shows final "processing completed successfully"
- No progress bars or percentage completion
- Silent for most of the process

## Testing Integration

These tools are used by the testing framework to generate reference hashes:

```bash
# Generate reference hashes from original tools
cd testing
npm run generate

# This runs iz.exe + ez.exe on all test files and saves hashes to:
# - testing/test_hashes/tools/extraction/original_hashes.json
# - testing/reference_original/ (extracted files)
```

See `../testing/README.md` for complete testing workflow documentation.

## Location

**Binary files:** `bin/` directory
- All .exe files have execute permissions
- Can be run directly via Wine

**Documentation:** This README.md file
- Describes all available tools
- Documents usage patterns
- Notes known issues

## License

These are proprietary tools from Granado Espada. Used for reference validation only.
