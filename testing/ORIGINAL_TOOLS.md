# Original Tools Documentation

## Tool Locations

### Windows Original Tools (via Wine)
**Location:** `/home/ecila/Games/Granado Espada Classique/tools/ge-library/releases/original/bin/`

**Available Tools:**
- `iz.exe` - IPF to ZIP converter (extract step 1)
- `ez.exe` - ZIP extractor (extract step 2)
- `cz.exe` - Folder to ZIP converter (create step 1)
- `zi.exe` - ZIP to IPF converter (create step 2)
- `oz.exe` - IPF optimizer
- `af.exe` - Add folder to IPF
- `ix3.exe` - IES to XML/PRN converter

## Tool Usage Patterns

### Extract IPF File

**Process:** IPF → ZIP → Extracted Files

**Commands:**
```bash
# Step 1: Convert IPF to ZIP (creates .zip in same directory as IPF)
wine /path/to/bin/iz.exe <ipf_file.ipf>

# Step 2: Extract ZIP to directory
wine /path/to/bin/ez.exe <path/to/zip_file.zip>

# Step 3: Delete ZIP file
rm <path/to/zip_file.zip>
```

**Example:**
```bash
cd /path/to/ipf/files
wine /home/ecila/Games/Granado\ Espada\ Classique/tools/ge-library/releases/original/bin/iz.exe ai.ipf
wine /home/ecila/Games/Granado\ Espada\ Classique/tools/ge-library/releases/original/bin/ez.exe ai.zip
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
wine /path/to/bin/cz.exe <folder_path>

# Step 2: Convert ZIP to IPF
wine /path/to/bin/zi.exe <zip_file.zip>

# Step 3: Delete ZIP file
rm <zip_file.zip>
```

**Example:**
```bash
wine /home/ecila/Games/Granado\ Espada\ Classique/tools/ge-library/releases/original/bin/cz.exe ai/
wine /home/ecila/Games/Granado\ Espada\ Classique/tools/ge-library/releases/original/bin/zi.exe ai.zip
rm ai.zip
```

### Optimize IPF

**Process:** IPF → Optimized IPF

**Command:**
```bash
wine /path/to/bin/oz.exe <ipf_file.ipf>
```

### Add Folder to IPF

**Process:** IPF + Folder → Updated IPF

**Command:**
```bash
wine /path/to/bin/af.exe <ipf_file.ipf> <folder_path>
```

### Convert IES to XML/PRN

**Process:** IES → CSV/PRN

**Command:**
```bash
wine /path/to/bin/ix3.exe <ies_file.ies>
```

## Current Working Directories

### Test Files
**Location:** `/home/ecila/Games/Granado Espada Classique/tools/ge-library/testing/test_files/`

**Contents:**
- `ai.ipf` (4.3 KB) - Small test file
- `item_texture.ipf` (191 MB) - Medium test file
- `ui.ipf` (921 MB) - Large test file

### Reference Extractions
**Location:** `/home/ecila/Games/Granado Espada Classique/tools/ge-library/testing/reference_original/`

**Purpose:** Contains extractions from original Windows tools (iz.exe + ez.exe)

**Current Structure:**
```
reference_original/
├── small_original/      # ai.ipf extraction
├── medium_original/     # item_texture.ipf extraction (TODO)
└── large_original/      # ui.ipf extraction (TODO)
```

### Our Tool Extractions
**Location:** `/home/ecila/Games/Granado Espada Classique/tools/ge-library/testing/reference_our/`

**Purpose:** Temporary storage for our tool's extractions during testing. Files are cleaned up after test runs unless `--keep` flag is used. Hashes are always preserved in `test_hashes/tools/extraction/our_hashes.json`.

**Structure:**
```
reference_our/
├── small_our/       # ai.ipf extraction
├── medium_our/      # item_texture.ipf extraction
└── large_our/       # ui.ipf extraction
```

**Usage:** Used by `npm test` command for validation. Directory is cleaned up after tests complete unless `--keep` flag is provided.

### Validation Results

**Location:** `/home/ecila/Games/Granado Espada Classique/tools/ge-library/testing/test_hashes/tools/`

**Files:**
- `extraction/original_hashes.json` - Reference hashes from original Windows tools
- `extraction/our_hashes.json` - Hashes from our Go IPF extractor

**Hash Database Structure:**

**original_hashes.json:**
```json
{
  "generated_at": "2026-01-19T...",
  "purpose": "Reference hashes from original Windows tools (iz.exe + ez.exe)",
  "tool": "Original Windows tools (iz.exe + ez.exe)",
  "test_files": {
    "small": {
      "test_file": "ai.ipf",
      "extracted_files": { /* hash data */ },
      "timestamp": "..."
    },
    ...
  }
}
```

**our_hashes.json:**
```json
{
  "generated_at": "2026-01-19T...",
  "purpose": "Hashes from our Go IPF extractor",
  "tool": "Our Go IPF extractor",
  "test_files": {
    "small": {
      "test_file": "ai.ipf",
      "extracted_files": { /* hash data */ },
      "timestamp": "..."
    },
    ...
  }
}
```

**Usage:**
- `npm run generate` - Updates `original_hashes.json` from original tool extractions
- `npm test` - Updates `our_hashes.json` from our tool, compares against original hashes

## Known Issues with Original Tools

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

## Testing Procedure

### Generate Fresh Reference Hashes

```bash
# For small test file (ai.ipf)
cd /home/ecila/Games/Granado\ Espada\ Classique/tools/ge-library/testing/test_files
wine /home/ecila/Games/Granado\ Espada\ Classique/tools/ge-library/releases/original/bin/iz.exe ai.ipf
wine /home/ecila/Games/Granado\ Espada\ Classique/tools/ge-library/releases/original/bin/ez.exe ai.zip
mv ai ../reference_original/small_original
rm ai.zip

# For medium test file (item_texture.ipf)
wine /home/ecila/Games/Granado\ Espada\ Classique/tools/ge-library/releases/original/bin/iz.exe item_texture.ipf
wine /home/ecila/Games/Granado\ Espada\ Classique/tools/ge-library/releases/original/bin/ez.exe item_texture.zip
mv item_texture ../reference_original/medium_original
rm item_texture.zip

# For large test file (ui.ipf)
wine /home/ecila/Games/Granado\ Espada\ Classique/tools/ge-library/releases/original/bin/iz.exe ui.ipf
wine /home/ecila/Games/Granado\ Espada\ Classique/tools/ge-library/releases/original/bin/ez.exe ui.zip
mv ui ../reference_original/large_original
rm ui.zip
```

### Generate Hash Database

```bash
cd /home/ecila/Games/Granado\ Espada\ Classique/tools/ge-library/testing
npm run generate -- --ipf-path ./reference_original --output-dir ./test_hashes/tools
```

This will create fresh `extraction_hashes.json` based on original tool extractions.

## Comparison Strategy

### Phase 1: Original Tools Only
1. Extract all 3 test files with original tools
2. Generate reference hashes from these extractions
3. **Baseline** - This establishes ground truth

### Phase 2: Our Tool
1. Extract all 3 test files with our Go implementation
2. Generate hashes from our extractions
3. **Compare** - Check if our tool matches original exactly

### Phase 3: Analysis
1. Identify any discrepancies
2. Document why differences occur
3. Fix issues in our implementation
4. **Goal**: Byte-for-byte identical extraction

## Hash Comparison Notes

### Manifest Hash Mismatch
Current validation shows `manifest_hash_match: false` because:
- `temp_validation/ai_validation/` contains **old extractions from previous runs**
- These were extracted at different times/with different tools
- Reference hashes in `extraction_hashes.json` are from different extractions

### Solution
Generate fresh extractions using original tools (see above) and regenerate reference hashes.

### File Hash Matches
Individual file hashes from reference (`extraction_hashes.json`) match the files currently in `temp_validation/ai_validation/`.

This means:
- Files are correctly extracted
- Hash calculation is working
- **Only manifest hash differs** due to different extraction source/timestamp
