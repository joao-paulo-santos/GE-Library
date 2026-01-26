# GE-Library Workflows

This folder contains build and release workflow scripts.

## Scripts

### build.sh

Main build wrapper that organizes all build operations. Provides a clean, organized interface to the Makefile build system.

**Features:**
- Colored output for better readability
- All build commands in one place
- Calls underlying Makefile in src/golang/
- Platform-specific build commands
- Automatic cleanup after release

**Commands:**
```bash
./workflows/build.sh [command]
```

Available commands:
- `clean`          Clean all build artifacts
- `deps`           Download Go dependencies
- `test`           Run tests
- `build`          Build for current platform
- `build-all`      Build all platforms
- `release`        Build complete release (all platforms + packages + cleanup)
- `help`           Show help message

Platform-specific builds:
- `build-linux`        Build Linux amd64
- `build-linux-arm64`  Build Linux arm64
- `build-windows`      Build Windows amd64
- `build-windows-arm64`  Build Windows arm64
- `build-darwin`       Build macOS amd64
- `build-darwin-arm64  Build macOS arm64

**Examples:**
```bash
# Build current platform
./workflows/build.sh build

# Build complete release
./workflows/build.sh release

# Build specific platform
./workflows/build.sh build-linux

# Clean everything
./workflows/build.sh clean
```

### generate_patchnotes.js

Node.js script that generates PATCHNOTES.txt from the release notes JSON database.

**Features:**
- Reads documentation/release_notes/release_notes.json
- Extracts last 5 releases
- Generates formatted PATCHNOTES.txt
- Includes GitHub link for older releases

**Usage:**
```bash
node workflows/generate_patchnotes.js
```

## Workflow

The complete release workflow:

1. **Edit release notes**
   ```bash
   vim documentation/release_notes/release_notes.json
   vim documentation/release_notes/README.txt
   ```

2. **Build release**
   ```bash
   ./workflows/build.sh release
   ```

   This automatically:
   - Generates PATCHNOTES.txt from JSON
   - Cleans previous builds
   - Downloads dependencies
   - Runs tests
   - Builds all 6 platforms
   - Creates release packages
   - Cleans up generated PATCHNOTES.txt

3. **Distribute**
   Upload zip files from `releases/ge-library/`

## Output

### After Release
- 6 platform zip files in `releases/ge-library/`
- Each zip contains: `tools/`, `README.txt`, `PATCHNOTES.txt`
- Generated `PATCHNOTES.txt` is cleaned up from project root

### Generated Files
- `PATCHNOTES.txt` - Generated in project root, cleaned after release
- Release packages - Persistent in `releases/ge-library/`

## Why workflows/?

Having all build scripts in one folder provides:
- **Organization**: All build-related scripts in one place
- **Discovery**: Easy to find all available workflows
- **Maintenance**: Central location for build tools
- **Consistency**: Uniform interface to build system
