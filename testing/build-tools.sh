#!/bin/bash

# Build Go tools from root for testing
# This ensures tests always use latest built versions from releases/ge-library/

set -e

cd "$(dirname "$0")/../.."

echo "=== Building Go Tools for Testing ==="
echo ""

# Call root build script (auto-detects current platform)
./build.sh

echo ""
echo "✓ Build complete!"
echo "✓ Testing tools updated to latest!"
echo "✓ Config points to: releases/ge-library/$PLATFORM_TARGET/"
