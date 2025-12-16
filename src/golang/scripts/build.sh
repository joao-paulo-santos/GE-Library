#!/bin/bash

# IPF Extractor Cross-Platform Build Script
# Usage: ./scripts/build.sh [target] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TARGET="all"
OUTPUT_DIR="dist"
VERSION=""
RACE=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)
            TARGET="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -r|--race)
            RACE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [target] [options]"
            echo ""
            echo "Targets:"
            echo "  all          Build for all platforms"
            echo "  linux        Build for Linux"
            echo "  windows      Build for Windows"
            echo "  darwin       Build for macOS"
            echo "  current      Build for current platform"
            echo ""
            echo "Options:"
            echo "  -t, --target   Build target (default: all)"
            echo "  -o, --output   Output directory (default: dist)"
            echo "  -v, --version  Version string (default: git commit)"
            echo "  -r, --race     Enable race detector"
            echo "  --verbose      Verbose output"
            echo "  -h, --help     Show this help"
            exit 0
            ;;
        *)
            TARGET="$1"
            shift
            ;;
    esac
done

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to get version from git
get_version() {
    if [[ -n "$VERSION" ]]; then
        echo "$VERSION"
    else
        git describe --tags --always --dirty 2>/dev/null || echo "dev"
    fi
}

# Function to check if Go is installed
check_go() {
    if ! command -v go &> /dev/null; then
        print_error "Go is not installed or not in PATH"
        exit 1
    fi

    GO_VERSION=$(go version)
    print_status "Using $GO_VERSION"
}

# Function to check dependencies
check_deps() {
    print_step "Checking dependencies..."

    # Check if go.mod exists
    if [[ ! -f "go.mod" ]]; then
        print_error "go.mod not found. Please run from project root."
        exit 1
    fi

    # Download dependencies
    print_status "Downloading Go modules..."
    go mod download
    go mod tidy
}

# Function to build for specific platform
build_platform() {
    local os=$1
    local arch=$2
    local ext=$3
    local output_name="ipf-extractor$ext"
    local output_dir="$OUTPUT_DIR/${os}-${arch}"

    print_step "Building for $os/$arch..."

    # Create output directory
    mkdir -p "$output_dir"

    # Set environment variables
    export CGO_ENABLED=0
    export GOOS="$os"
    export GOARCH="$arch"

    # Build flags
    local ldflags="-s -w"
    if [[ -n "$VERSION" ]]; then
        ldflags="$ldflags -X main.AppVersion=$(get_version)"
    fi

    # Additional build flags
    local build_flags=""
    if [[ "$RACE" == "true" ]]; then
        build_flags="$build_flags -race"
    fi

    if [[ "$VERBOSE" == "true" ]]; then
        build_flags="$build_flags -x"
    fi

    # Build command
    local cmd="go build $build_flags -ldflags=\"$ldflags\" -o \"$output_dir/$output_name\" ./cmd/ipf-extractor"

    if [[ "$VERBOSE" == "true" ]]; then
        echo "Running: $cmd"
    fi

    # Execute build
    if eval "$cmd"; then
        print_status "✓ Successfully built $output_dir/$output_name"

        # Show binary info
        if command -v file &> /dev/null; then
            file "$output_dir/$output_name" 2>/dev/null || true
        fi

        # Show binary size
        if command -v du &> /dev/null; then
            du -h "$output_dir/$output_name" 2>/dev/null || true
        fi
    else
        print_error "✗ Failed to build for $os/$arch"
        exit 1
    fi

    # Unset environment variables
    unset CGO_ENABLED
    unset GOOS
    unset GOARCH
}

# Function to build for all platforms
build_all() {
    print_step "Building for all platforms..."

    # Linux
    build_platform "linux" "amd64" ""
    build_platform "linux" "arm64" ""

    # Windows
    build_platform "windows" "amd64" ".exe"
    build_platform "windows" "arm64" ".exe"

    # macOS
    build_platform "darwin" "amd64" ""
    build_platform "darwin" "arm64" ""
}

# Function to build for Linux
build_linux() {
    build_platform "linux" "amd64" ""
    build_platform "linux" "arm64" ""
}

# Function to build for Windows
build_windows() {
    build_platform "windows" "amd64" ".exe"
    build_platform "windows" "arm64" ".exe"
}

# Function to build for macOS
build_darwin() {
    build_platform "darwin" "amd64" ""
    build_platform "darwin" "arm64" ""
}

# Function to build for current platform
build_current() {
    local current_os=$(go env GOOS)
    local current_arch=$(go env GOARCH)

    if [[ "$current_os" == "windows" ]]; then
        build_platform "$current_os" "$current_arch" ".exe"
    else
        build_platform "$current_os" "$current_arch" ""
    fi
}

# Function to create release archives
create_archives() {
    print_step "Creating release archives..."

    cd "$OUTPUT_DIR"

    for dir in */; do
        if [[ -d "$dir" ]]; then
            platform=${dir%/}
            echo "Creating archive for $platform..."

            if [[ "$platform" == windows* ]]; then
                # Create ZIP for Windows
                zip -r "${platform}.zip" "$dir"
            else
                # Create tar.gz for Unix-like systems
                tar -czf "${platform}.tar.gz" "$dir"
            fi
        fi
    done

    cd ..
    print_status "✓ Release archives created in $OUTPUT_DIR/"
}

# Function to show summary
show_summary() {
    print_step "Build Summary"
    echo "Target: $TARGET"
    echo "Output: $OUTPUT_DIR"
    echo "Version: $(get_version)"
    echo "Race Detector: $RACE"

    if [[ -d "$OUTPUT_DIR" ]]; then
        echo ""
        echo "Built binaries:"
        find "$OUTPUT_DIR" -type f -name "ipf-extractor*" -exec ls -lh {} \; 2>/dev/null || true
    fi
}

# Main execution
main() {
    print_status "IPF Extractor Build Script"
    print_status "=========================="

    # Change to project root
    cd "$(dirname "$0")/.."

    # Check prerequisites
    check_go
    check_deps

    # Clean previous builds
    if [[ -d "$OUTPUT_DIR" ]]; then
        print_step "Cleaning previous builds..."
        rm -rf "$OUTPUT_DIR"
    fi

    # Set version if not provided
    if [[ -z "$VERSION" ]]; then
        VERSION=$(get_version)
    fi

    print_status "Building version: $VERSION"

    # Build based on target
    case "$TARGET" in
        all)
            build_all
            create_archives
            ;;
        linux)
            build_linux
            ;;
        windows)
            build_windows
            ;;
        darwin)
            build_darwin
            ;;
        current)
            build_current
            ;;
        *)
            print_error "Unknown target: $TARGET"
            echo "Available targets: all, linux, windows, darwin, current"
            exit 1
            ;;
    esac

    # Show summary
    show_summary

    print_status "✓ Build completed successfully!"
}

# Run main function
main "$@"