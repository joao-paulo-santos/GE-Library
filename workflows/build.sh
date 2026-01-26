#!/bin/bash
#
# GE-Library Build Script
# Wrapper for organizing all build operations in workflows/
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to golang directory
cd "$PROJECT_ROOT/src/golang"

# Print header
echo -e "${GREEN}GE-Library Build System${NC}"
echo -e "${BLUE}========================${NC}"
echo ""

# Function to show usage
show_usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  clean          Clean all build artifacts"
    echo "  deps           Download Go dependencies"
    echo "  test           Run tests"
    echo "  build          Build for current platform"
    echo "  build-all      Build all platforms"
    echo "  release        Build complete release (all platforms + packages)"
    echo "  help           Show this help message"
    echo ""
    echo "Platform-specific builds:"
    echo "  build-linux        Build Linux amd64"
    echo "  build-linux-arm64  Build Linux arm64"
    echo "  build-windows      Build Windows amd64"
    echo "  build-windows-arm64  Build Windows arm64"
    echo "  build-darwin       Build macOS amd64"
    echo "  build-darwin-arm64  Build macOS arm64"
    echo ""
    echo "Options:"
    echo "  --verbose     Show detailed make output"
    echo "  --no-color    Disable colored output"
    echo ""
    echo "Examples:"
    echo "  $0 build              # Build current platform"
    echo "  $0 release            # Build complete release"
    echo "  $0 build-linux        # Build Linux amd64"
}

# Function to run make command
run_make() {
    local target="$1"
    shift
    echo -e "${BLUE}Running: make $target${NC}"
    echo ""
    
    if [ "$1" = "--verbose" ]; then
        make "$target" VERBOSE=1
    else
        make "$target"
    fi
}

# Main script logic
main() {
    local command="$1"
    
    # Parse command
    case "$command" in
        clean)
            run_make "clean"
            echo -e "${GREEN}✓ Clean complete${NC}"
            ;;
        deps)
            run_make "deps"
            echo -e "${GREEN}✓ Dependencies installed${NC}"
            ;;
        test)
            run_make "test"
            echo -e "${GREEN}✓ Tests complete${NC}"
            ;;
        build)
            run_make "build"
            echo -e "${GREEN}✓ Build complete${NC}"
            ;;
        build-all)
            run_make "build-all"
            echo -e "${GREEN}✓ All platforms built${NC}"
            ;;
        release)
            run_make "release"
            echo -e "${GREEN}✓ Release complete${NC}"
            echo ""
            echo -e "${BLUE}Release packages:${NC}"
            find "$PROJECT_ROOT/releases/ge-library" -name "*.zip" -type f | sort
            ;;
        build-linux)
            run_make "build-linux"
            echo -e "${GREEN}✓ Linux amd64 built${NC}"
            ;;
        build-linux-arm64)
            run_make "build-linux-arm64"
            echo -e "${GREEN}✓ Linux arm64 built${NC}"
            ;;
        build-windows)
            run_make "build-windows"
            echo -e "${GREEN}✓ Windows amd64 built${NC}"
            ;;
        build-windows-arm64)
            run_make "build-windows-arm64"
            echo -e "${GREEN}✓ Windows arm64 built${NC}"
            ;;
        build-darwin)
            run_make "build-darwin"
            echo -e "${GREEN}✓ macOS amd64 built${NC}"
            ;;
        build-darwin-arm64)
            run_make "build-darwin-arm64"
            echo -e "${GREEN}✓ macOS arm64 built${NC}"
            ;;
        help|--help|-h)
            show_usage
            ;;
        "")
            echo -e "${YELLOW}No command specified${NC}"
            echo ""
            show_usage
            exit 1
            ;;
        *)
            echo -e "${RED}Unknown command: $command${NC}"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
