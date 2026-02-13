#!/bin/bash

# GE-Library Release Automation Script
# Creates automated releases with proper git workflow and GitHub integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
DRY_RUN=false
HELP=false

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# File paths
RELEASE_NOTES_FILE="$PROJECT_ROOT/documentation/release_notes/release_notes.json"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            HELP=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Show help
if [ "$HELP" = true ]; then
    cat << EOF
GE-Library Release Automation

Usage: $0 [options]

Options:
  --dry-run    Validate and preview release without executing
  --help, -h   Show this help message

Workflow:
  1. Validate prerequisites (main branch, no uncommitted changes, gh CLI)
  2. Extract version from release_notes.json
  3. Check release doesn't already exist
  4. Run tests (Go + Node)
  5. Create release branch (releases/<version>)
  6. Build all platform packages
  7. Create git tag v<version>
  8. Push to GitHub
  9. Create GitHub release with assets

Examples:
  $0                    # Perform actual release
  $0 --dry-run          # Preview release without making changes

EOF
    exit 0
fi

# Print functions
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

dry_run() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY RUN]${NC} $1"
    fi
}

# Main execution
main() {
    cd "$PROJECT_ROOT"
    
    echo "================================================================================"
    echo "                    GE-Library Release Automation"
    echo "================================================================================"
    echo ""
    
    if [ "$DRY_RUN" = true ]; then
        warn "DRY RUN MODE - No changes will be made"
        echo ""
    fi
    
    # ============================================================================
    # 1. Prerequisites Validation
    # ============================================================================
    step "Checking prerequisites..."
    
    # Check current branch
    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ]; then
        error "Must be on main branch (currently on: $current_branch)"
        echo ""
        echo "Hint: Run: git checkout main"
        exit 1
    fi
    info "✓ On branch: main"
    
    # Check for uncommitted changes
    if ! git diff --quiet || ! git diff --cached --quiet; then
        error "Uncommitted changes detected"
        echo ""
        echo "Hint: Run: git status"
        echo "      Commit or stash changes first"
        exit 1
    fi
    info "✓ No uncommitted changes"
    
    
    # Check gh CLI
    if ! command -v gh &> /dev/null; then
        error "GitHub CLI not installed"
        echo ""
        echo "Install from: https://cli.github.com/"
        echo "  macOS:   brew install gh"
        echo "  Ubuntu:  sudo snap install gh"
        exit 1
    fi
    info "✓ GitHub CLI installed"
    
    # Check gh authentication
    if ! gh auth status &> /dev/null; then
        error "GitHub CLI not authenticated"
        echo ""
        echo "Run: gh auth login"
        exit 1
    fi
    gh_auth_user=$(gh auth status | grep "Logged in as" | head -1 | sed 's/.*Logged in as //' || echo "unknown")
    info "✓ GitHub CLI authenticated as: $gh_auth_user"
    echo ""
    
    # ============================================================================
    # 2. Version Detection
    # ============================================================================
    step "Reading release information..."
    
    if [ ! -f "$RELEASE_NOTES_FILE" ]; then
        error "Release notes file not found: $RELEASE_NOTES_FILE"
        exit 1
    fi

    # Extract version using Node (absolute path)
    abs_json_path="$(pwd)/documentation/release_notes/release_notes.json"
    version=$(node -p "require('$abs_json_path').releases.at(-1).version")
    release_type=$(node -p "require('$abs_json_path').releases.at(-1).type")
    release_date=$(node -p "require('$abs_json_path').releases.at(-1).date")

    # Validate version format (accepts 0.1, 1.0.0, etc.)
    if ! [[ "$version" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
        error "Invalid version format: $version"
        exit 1
    fi
    
    info "Release version: $version"
    info "Release type: $release_type"
    info "Release date: $release_date"
    echo ""
    
    # ============================================================================
    # 3. Check for Existing Release
    # ============================================================================
    step "Checking for existing release..."
    
    # Fetch all tags
    if [ "$DRY_RUN" = false ]; then
        git fetch --tags --quiet 2>/dev/null || true
    fi
    
    # Check if tag exists
    if git rev-parse "v$version" &>/dev/null 2>&1; then
        error "Tag v$version already exists"
        echo ""
        echo "Hint: Update version in $RELEASE_NOTES_FILE"
        echo "      Or delete existing tag: git tag -d v$version && git push --delete origin v$version"
        exit 1
    fi
    
    # Check if branch exists remotely
    if git show-ref --verify --quiet "refs/remotes/origin/releases/$version" 2>/dev/null; then
        error "Branch releases/$version already exists"
        echo ""
        echo "Hint: Delete remote branch: git push origin --delete releases/$version"
        exit 1
    fi
    
    info "✓ Release $version does not exist"
    echo ""
    
    # ============================================================================
    # 4. Run Tests (Before Creating Branch)
    # ============================================================================
    step "Running test suite..."
    
    # Run Go tests
    if [ "$DRY_RUN" = true ]; then
        dry_run "Would run: cd src/golang && make test"
        dry_run "Would run: cd testing && npm test"
    else
        info "Running Go tests..."
        cd "$PROJECT_ROOT/src/golang"
        if ! make test; then
            error "Go tests failed. Aborting release."
            echo ""
            echo "Fix failing tests before proceeding with release"
            exit 1
        fi
        cd "$PROJECT_ROOT"
        info "✓ Go tests passed"
        
        info "Running Node tests..."
        cd "$PROJECT_ROOT/testing"
        if ! npm test; then
            error "Node tests failed. Aborting release."
            echo ""
            echo "Fix failing tests before proceeding with release"
            exit 1
        fi
        cd "$PROJECT_ROOT"
        info "✓ Node tests passed"
    fi
    
    info "✓ All tests passed"
    echo ""
    
    # ============================================================================
    # 5. Create Release Branch
    # ============================================================================
    step "Creating release branch..."
    
    branch_name="releases/$version"
    
    if [ "$DRY_RUN" = true ]; then
        dry_run "Would create branch: $branch_name"
        dry_run "Would checkout: main"
    else
        git checkout -b "$branch_name"
        git checkout main
        info "✓ Created branch: $branch_name"
        info "✓ Switched back to main"
    fi
    echo ""
    
    # ============================================================================
    # 6. Build Release
    # ============================================================================
    step "Building release packages..."
    
    if [ "$DRY_RUN" = true ]; then
        dry_run "Would run: cd src/golang && make release"
        dry_run ""
        dry_run "Would build 6 platform binaries:"
        dry_run "  - linux-amd64 (ipf-extractor, ipf-optimizer, ipf-creator)"
        dry_run "  - linux-arm64 (ipf-extractor, ipf-optimizer, ipf-creator)"
        dry_run "  - windows-amd64 (ipf-extractor.exe, ipf-optimizer.exe, ipf-creator.exe)"
        dry_run "  - windows-arm64 (ipf-extractor.exe, ipf-optimizer.exe, ipf-creator.exe)"
        dry_run "  - darwin-amd64 (ipf-extractor, ipf-optimizer, ipf-creator)"
        dry_run "  - darwin-arm64 (ipf-extractor, ipf-optimizer, ipf-creator)"
        dry_run ""
        dry_run "Would create 6 zip packages:"
        dry_run "  - ge-library-linux-amd64.zip"
        dry_run "  - ge-library-linux-arm64.zip"
        dry_run "  - ge-library-windows-amd64.zip"
        dry_run "  - ge-library-windows-arm64.zip"
        dry_run "  - ge-library-darwin-amd64.zip"
        dry_run "  - ge-library-darwin-arm64.zip"
    else
        cd "$PROJECT_ROOT/src/golang"
        if ! make release; then
            error "Build failed. Aborting release."
            exit 1
        fi
        cd "$PROJECT_ROOT"
        
        info "✓ Build completed successfully"
        echo ""
        
        # List created files
        info "Release packages created:"
        find "$PROJECT_ROOT/releases/ge-library" -name "*.zip" -type f | while read -r file; do
            size=$(du -h "$file" | cut -f1)
            basename "$file"
        done | sort | while read -r line; do
            filename=$(echo "$line" | cut -d' ' -f2)
            size=$(echo "$line" | cut -d' ' -f1)
            echo "  • $filename ($size)"
        done
    fi
    echo ""
    
    # ============================================================================
    # 7. Generate Version-Specific Release Notes
    # ============================================================================
    step "Generating release notes..."

    release_notes_temp=$(mktemp)

    # Generate markdown notes for latest version using Node script
    if [ "$DRY_RUN" = true ]; then
        dry_run "Would generate release notes for version $version"
        dry_run "Using: node workflows/generate_patchnotes.js --latest --output $release_notes_temp"
    else
        node "$SCRIPT_DIR/generate_patchnotes.js" --latest --output "$release_notes_temp"
        info "✓ Release notes generated"
    fi
    
    # ============================================================================
    # 8. Create and Push Tag
    # ============================================================================
    step "Creating git tag..."
    
    tag_name="v$version"
    
    if [ "$DRY_RUN" = true ]; then
        dry_run "Would create tag: $tag_name"
        dry_run "Would push branch: $branch_name to origin"
        dry_run "Would push tag: $tag_name to origin"
    else
        git tag -a "$tag_name" -m "Release $tag_name"
        git push origin "$branch_name"
        git push origin "$tag_name"
        
        info "✓ Created tag: $tag_name"
        info "✓ Pushed branch: $branch_name"
        info "✓ Pushed tag: $tag_name"
    fi
    echo ""
    
    # ============================================================================
    # 9. Create GitHub Release
    # ============================================================================
    step "Creating GitHub release..."
    
    release_url="https://github.com/joao-paulo-santos/GE-Library/releases/tag/$tag_name"
    
    if [ "$DRY_RUN" = true ]; then
        dry_run "Would create GitHub release: $release_url"
        dry_run ""
        dry_run "Would upload 6 files:"
        find "$PROJECT_ROOT/releases/ge-library" -name "*.zip" -type f -exec basename {} \; | sort | sed 's/^/  - /'
    else
        # Create release
        gh release create "$tag_name" \
            --title "GE-Library $tag_name" \
            --notes-file "$release_notes_temp" \
            --latest
        
        info "✓ GitHub release created: $release_url"
        
        # Upload assets
        info "Uploading release assets..."
        asset_count=0
        total_size=0
        find "$PROJECT_ROOT/releases/ge-library" -name "*.zip" -type f | while read -r file; do
            filename=$(basename "$file")
            size=$(du -k "$file" | cut -f1)
            
            gh release upload "$tag_name" "$file" --clobber
            info "✓ Uploaded $filename ($((size / 1024)) MB)"
            ((asset_count++))
            ((total_size += size))
        done || true  # Handle subshell exit
        
        info "✓ Uploaded $asset_count files"
    fi
    
    # Cleanup temp file
    rm -f "$release_notes_temp"
    echo ""
    
    # ============================================================================
    # 10. Final Summary
    # ============================================================================
    echo "================================================================================"
    echo "                            Release Complete!"
    echo "================================================================================"
    echo ""
    echo "Version: $version"
    echo "Release Type: $release_type"
    echo "Release Date: $release_date"
    echo ""
    
    if [ "$DRY_RUN" = true ]; then
        warn "DRY RUN MODE - No changes were made"
        echo ""
        echo "To perform actual release, run without --dry-run flag:"
        echo "  $0"
    else
        echo "Release URL: $release_url"
        echo "Release Branch: $branch_name"
        echo ""
        
        # Count files
        file_count=$(find "$PROJECT_ROOT/releases/ge-library" -name "*.zip" -type f 2>/dev/null | wc -l)
        echo "Assets Uploaded: $file_count files"
        echo ""
        echo "Next steps:"
        echo "- Verify release at: $release_url"
        echo "- Update release_notes.json for next version"
    fi
    echo "================================================================================"
}

# Run main function
main "$@"
