#!/bin/bash

# Build Go tools to bin/ directory for testing
# This ensures tests always use the latest built versions

set -e

cd "$(dirname "$0")"

echo "=== Building Go Tools for Testing ==="

# Clean bin directory
if [ -d "bin" ]; then
    echo "Cleaning bin/..."
    rm -rf bin
fi

mkdir -p bin

echo "Building ipf-extractor..."
cd ../src/golang
go build -ldflags "-s -w" -o ../../bin/ipf-extractor ./cmd/ipf-extractor

echo "Building ipf-optimizer..."
go build -ldflags "-s -w" -o ../../bin/ipf-optimizer ./cmd/ipf-optimizer

cd ../..

echo ""
echo "✓ Build complete!"
echo "Binaries:"
ls -lh bin/
  
