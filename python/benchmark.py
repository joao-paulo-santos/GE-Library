#!/usr/bin/env python3
"""
Performance benchmark for sequential vs parallel IPF extraction
"""

import time
import tempfile
import shutil
import sys
import os
from pathlib import Path

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from ipf_extractor import process_ipf_file
from ipf_extractor_parallel import process_ipf_file_parallel
from ipf_extractor_optimized import process_ipf_file_optimized

def benchmark_extraction(ipf_file, max_workers_list=[1, 2, 4, 8]):
    """Run performance benchmarks for different worker configurations"""
    print(f"📊 Benchmarking IPF extraction: {ipf_file}")
    print("=" * 60)

    if not os.path.exists(ipf_file):
        print(f"❌ Error: IPF file not found: {ipf_file}")
        return

    # Get file size for context
    file_size = os.path.getsize(ipf_file)
    print(f"File size: {file_size:,} bytes ({file_size/1024/1024:.1f} MB)")
    print()

    # Sequential benchmark (with optimized logging)
    print("🐌 Sequential extraction (optimized logging):")
    with tempfile.TemporaryDirectory() as tmp_dir:
        start_time = time.time()
        success = True #process_ipf_file(ipf_file, tmp_dir, verbose=False)
        sequential_time = time.time() - start_time
        
        if success:
            # Count extracted files
            file_count = len(list(Path(tmp_dir).glob("*")))
            print(f"   ✅ Extracted {file_count} files in {sequential_time:.2f} seconds")
            print(f"   📈 Speed: {file_count/sequential_time:.1f} files/sec, {file_size/sequential_time/1024:.1f} KB/sec")
        else:
            print("   ❌ Failed")

    print()

    # Optimized parallel benchmarks
    print("🚀 Optimized Parallel extraction:")
    for workers in max_workers_list:
        print(f"   {workers} workers:")

        with tempfile.TemporaryDirectory() as tmp_dir:
            start_time = time.time()
            success = process_ipf_file_optimized(ipf_file, tmp_dir, max_workers=workers, verbose=False)
            parallel_time = time.time() - start_time

            if success:
                # Count extracted files
                file_count = len(list(Path(tmp_dir).glob("*")))
                speedup = sequential_time / parallel_time if parallel_time > 0 else float('inf')

                print(f"   ✅ Extracted {file_count} files in {parallel_time:.2f} seconds")
                print(f"   📈 Speed: {file_count/parallel_time:.1f} files/sec, {file_size/parallel_time/1024:.1f} KB/sec")
                print(f"   ⚡ Speedup: {speedup:.2f}x (vs sequential)")
            else:
                print(f"   ❌ Failed")

        print()

    print("=" * 60)

def main():
    if len(sys.argv) < 2:
        print("Usage: python benchmark.py <file.ipf> [workers...]")
        print("\nExample: python benchmark.py ai.ipf 1 2 4 8")
        print("Default workers: 1 2 4 8")
        sys.exit(1)

    ipf_file = sys.argv[1]

    # Parse worker counts
    if len(sys.argv) > 2:
        try:
            max_workers_list = [int(w) for w in sys.argv[2:]]
        except ValueError:
            print("Error: Worker counts must be integers")
            sys.exit(1)
    else:
        max_workers_list = [1, 2, 4, 8]

    benchmark_extraction(ipf_file, max_workers_list)

if __name__ == "__main__":
    main()