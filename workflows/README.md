# GE-Library Workflows

This folder contains build and release workflow scripts.

## Scripts

### release.sh

Automated release script that performs complete release workflow with GitHub integration.

**Features:**
- Validates prerequisites (main branch, no uncommitted changes, gh CLI, jq)
- Extracts version from release_notes.json
- Checks for existing releases
- Runs tests before creating release branch
- Creates release branch (releases/<version>)
- Builds all platform packages
- Creates git tag v<version>
- Pushes to GitHub
- Creates GitHub release with version-specific notes
- Attaches all platform zip files as assets
- Dry-run mode for safe validation

**Commands:**
```bash
./workflows/release.sh [options]
```

Options:
- `--dry-run`    Validate and preview release without executing
- `--help, -h`   Show help message

**Examples:**
```bash
# Perform actual release
./workflows/release.sh

# Preview release without making changes
./workflows/release.sh --dry-run
```

**Workflow:**
1. Validate prerequisites (main branch, no uncommitted changes, gh CLI, jq)
2. Extract version from release_notes.json
3. Check release doesn't already exist
4. Run tests (Go + Node)
5. Create release branch (releases/<version>)
6. Build all platform packages
7. Create git tag v<version>
8. Push to GitHub
9. Create GitHub release with assets

**Requirements:**
- Must be on main branch
- No uncommitted changes
- GitHub CLI (`gh`) installed and authenticated
- Node.js (for release notes generation and testing)
- Go, and Make installed (for building)

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

### Automated Release (Recommended)

1. **Edit release notes**
    ```bash
    vim documentation/release_notes/release_notes.json
    vim documentation/release_notes/README.txt
    ```

2. **Run automated release**
    ```bash
    ./workflows/release.sh
    ```

    This automatically:
    - Validates prerequisites (main branch, no uncommitted changes, gh CLI)
    - Checks release doesn't already exist
    - Runs tests (Go + Node)
    - Creates release branch (releases/<version>)
    - Builds all 6 platforms
    - Creates git tag v<version>
    - Pushes to GitHub
    - Creates GitHub release with version-specific notes
    - Attaches all platform zip files as assets

    **Dry-run mode** (validate without executing):
    ```bash
    ./workflows/release.sh --dry-run
    ```

### Manual Release (Legacy)

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
    Manually upload zip files from `releases/ge-library/` to GitHub releases

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
