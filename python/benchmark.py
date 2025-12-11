#!/usr/bin/env python3
"""
Simple IPF extraction benchmark (reference implementation for porting to other languages)
"""

import time
import tempfile
import sys
import os
from pathlib import Path

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from ipf_extractor import process_ipf_file

def benchmark_extraction(ipf_file):
    """Simple benchmark for reference extraction speed"""
    print(f"📊 IPF Extraction Benchmark (Python Reference)")
    print(f"File: {ipf_file}")
    print("=" * 50)

    if not os.path.exists(ipf_file):
        print(f"❌ Error: IPF file not found: {ipf_file}")
        return

    # Get file size for context
    file_size = os.path.getsize(ipf_file)
    print(f"File size: {file_size:,} bytes ({file_size/1024/1024:.1f} MB)")
    print()

    print("🐌 Python sequential extraction (reference implementation):")
    with tempfile.TemporaryDirectory() as tmp_dir:
        start_time = time.time()
        success = process_ipf_file(ipf_file, tmp_dir, verbose=False)
        extraction_time = time.time() - start_time

        if success:
            # Count extracted files
            file_count = len(list(Path(tmp_dir).glob("*")))
            print(f"   ✅ Extracted {file_count} files in {extraction_time:.2f} seconds")
            print(f"   📈 Speed: {file_count/extraction_time:.1f} files/sec")
            print(f"   📁 Size: {file_size/1024/1024:.1f} MB")
            print(f"   🚫 Bottleneck: Python zipfile library (slow decryption)")
        else:
            print("   ❌ Failed")

    print()
    print("💡 This Python implementation is provided as reference")
    print("   for porting to a faster language (C/C++, Rust, Go, etc.)")
    print("=" * 50)

def main():
    if len(sys.argv) < 2:
        print("Usage: python benchmark.py <file.ipf>")
        print("\nThis benchmarks the Python reference implementation.")
        print("Use this as a baseline when porting to other languages.")
        sys.exit(1)

    ipf_file = sys.argv[1]
    benchmark_extraction(ipf_file)

if __name__ == "__main__":
    main()