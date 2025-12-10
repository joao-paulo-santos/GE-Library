import sys
import os
import zipfile
import struct
import io
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from multiprocessing import cpu_count
import time
from collections import namedtuple
from typing import List, Dict, Optional, Tuple
import math

# Import core components from original extractor
from ipf_extractor import get_ipf_password, ZipCipher, make_safe_filename

# Structure to hold file extraction info
FileInfo = namedtuple('FileInfo', ['zip_info', 'decrypted_name', 'safe_name', 'index'])

class ProgressLogger:
    """
    Efficient progress logging that minimizes I/O overhead
    """

    def __init__(self, total_files: int, log_interval: float = 2.0):
        self.total_files = total_files
        self.log_interval = log_interval
        self.last_log_time = 0
        self.start_time = time.time()

        # Calculate smart logging intervals
        self.min_interval = max(100, int(self.total_files * 0.1))  # 10% or minimum 100
        self.log_steps = self._calculate_log_steps()

    def _calculate_log_steps(self):
        """Calculate optimal logging steps based on total files"""
        steps = []

        # For small files (< 1000), use 10% intervals
        if self.total_files < 1000:
            interval = max(100, int(self.total_files * 0.1))
        # For medium files (1000-10000), use 5% intervals
        elif self.total_files < 10000:
            interval = max(500, int(self.total_files * 0.05))
        # For large files (> 10000), use 1% intervals
        else:
            interval = max(1000, int(self.total_files * 0.01))

        # Generate logging steps
        for i in range(0, self.total_files + 1, interval):
            steps.append(i)
        if steps[-1] != self.total_files:
            steps.append(self.total_files)

        return set(steps)

    def should_log(self) -> bool:
        """Check if enough time has passed to log again"""
        return time.time() - self.last_log_time >= self.log_interval

    def log_progress(self, current: int, phase: str = "Processing"):
        """Log progress at optimal intervals"""
        # Log if it's a designated step OR enough time has passed
        if (current in self.log_steps or
            (current > 0 and self.should_log())):
            self.last_log_time = time.time()
            elapsed = self.last_log_time - self.start_time
            if elapsed > 0:
                rate = current / elapsed
                eta = (self.total_files - current) / rate if rate > 0 else 0
                percent = (current / self.total_files) * 100

                # Use carriage return for same-line updates
                sys.stdout.write(f"\r{phase}: {current}/{self.total_files} "
                               f"({percent:.1f}%) - {rate:.0f} files/sec, ETA: {eta:.0f}s")
                sys.stdout.flush()

    def finish_progress(self, phase: str = "Processing"):
        """Clear the progress line and show final status"""
        elapsed = time.time() - self.start_time
        rate = self.total_files / elapsed
        print(f"\r✓ {phase} completed: {self.total_files} files in {elapsed:.1f}s "
              f"({rate:.0f} files/sec)")

class ParallelFilenameProcessor:
    """
    Handles parallel filename decryption using ThreadPoolExecutor
    """

    def __init__(self, max_workers: Optional[int] = None, verbose: bool = False):
        self.max_workers = max_workers or min(8, cpu_count())
        self.password = get_ipf_password()
        self.verbose = verbose

    def _process_single_filename(self, args: Tuple) -> Optional[FileInfo]:
        """Process a single filename in a worker thread"""
        file_info, index, ipf_path = args

        try:
            # Each worker gets its own cipher instance to avoid conflicts
            cipher = ZipCipher()
            cipher.init_keys(self.password)

            # Reopen IPF file for this filename read
            with open(ipf_path, 'rb') as file:
                # Read encrypted filename from local header
                local_header_offset = file_info.header_offset

                # Get filename length from local header
                name_len_offset = local_header_offset + 26
                file.seek(name_len_offset)
                name_len_bytes = file.read(2)

                if len(name_len_bytes) != 2:
                    return None

                name_len = struct.unpack('<H', name_len_bytes)[0]

                if name_len == 0 or name_len > 512:
                    return None

                # Read encrypted filename
                filename_offset = local_header_offset + 30
                file.seek(filename_offset)
                encrypted_name = file.read(name_len)

                if len(encrypted_name) != name_len:
                    return None

                # Decrypt filename
                decrypted_name = cipher.decrypt_data(encrypted_name)

                # Try to decode as text
                decoded_name = None
                for encoding in ['utf-8', 'latin-1', 'cp1252', 'ascii']:
                    try:
                        decoded = decrypted_name.decode(encoding)
                        if decoded and all(32 <= ord(c) <= 126 or c in '._-/' for c in decoded):
                            decoded_name = decoded
                            break
                    except:
                        continue

                # Try Japanese encoding as fallback
                if not decoded_name:
                    try:
                        decoded = decrypted_name.decode('cp932', errors='ignore')
                        if decoded and len(decoded) > 1:
                            decoded_name = decoded
                    except:
                        pass

                # Create safe filename
                safe_name = make_safe_filename(decoded_name) if decoded_name else f"file_{index:04d}.bin"

                return FileInfo(
                    zip_info=file_info,
                    decrypted_name=decoded_name,
                    safe_name=safe_name,
                    index=index
                )

        except Exception as e:
            print(f"Error processing filename {index}: {e}")
            return FileInfo(
                zip_info=file_info,
                decrypted_name=None,
                safe_name=f"file_{index:04d}.bin",
                index=index
            )

    def process_all_filenames(self, ipf_path: str, file_infos: List[zipfile.ZipInfo]) -> List[FileInfo]:
        """Process all filenames in parallel"""
        print(f"Decrypting {len(file_infos)} filenames using {self.max_workers} workers...")

        # Initialize progress logger
        progress = ProgressLogger(len(file_infos), log_interval=2.0) if not self.verbose else None

        # Prepare arguments for parallel processing
        args_list = [(file_info, i, ipf_path) for i, file_info in enumerate(file_infos)]

        # Process in parallel
        results = []
        completed_count = 0

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all tasks
            future_to_index = {
                executor.submit(self._process_single_filename, args): i
                for i, args in enumerate(args_list)
            }

            # Collect results as they complete
            for future in as_completed(future_to_index):
                result = future.result()
                if result:
                    results.append(result)
                    completed_count += 1

                    # Only log progress periodically or in verbose mode
                    if self.verbose:
                        if result.decrypted_name:
                            print(f"✓ {result.index + 1}/{len(file_infos)}: {result.decrypted_name}")
                        else:
                            print(f"? {result.index + 1}/{len(file_infos)}: {result.safe_name}")
                    elif progress:
                        progress.log_progress(completed_count, "Decrypting filenames")

        # Final progress update
        if progress:
            progress.finish_progress("Filename decryption")
        else:
            print(f"✓ Decrypted {len(results)} filenames")

        # Sort results by original index to maintain order
        results.sort(key=lambda x: x.index)
        return results

class OptimizedParallelExtractor:
    """
    Optimized parallel file extractor that minimizes I/O overhead
    """

    def __init__(self, max_workers: Optional[int] = None, verbose: bool = False):
        self.max_workers = max_workers or min(8, cpu_count())
        self.verbose = verbose
        self._lock = threading.Lock()
        self._extracted_count = 0
        self._total_count = 0
        self._start_time = 0
        self._progress_logger = None

    def _extract_single_file_optimized(self, args: Tuple) -> Tuple[bool, str, int]:
        """Extract a single file using pre-opened ZIP file"""
        file_info, output_path, ipf_zip = args

        try:
            # Use the pre-opened ZipFile object (much more efficient!)
            with ipf_zip.open(file_info.zip_info, pwd=get_ipf_password()) as member_file:
                with open(output_path, 'wb') as output_file:
                    # Stream the file in chunks
                    buffer_size = 65536  # Larger buffer for better performance
                    total_size = 0
                    while True:
                        chunk = member_file.read(buffer_size)
                        if not chunk:
                            break
                        output_file.write(chunk)
                        total_size += len(chunk)

            # Update progress counter (minimal locking)
            with self._lock:
                self._extracted_count += 1
                # Only log progress periodically to avoid I/O bottleneck
                if not self.verbose and self._progress_logger:
                    self._progress_logger.log_progress(self._extracted_count, "Extracting files")

            return True, file_info.safe_name, total_size

        except Exception as e:
            if self.verbose:
                print(f"✗ Failed to extract {file_info.safe_name}: {e}")
            return False, file_info.safe_name, 0

    def extract_files_optimized(self, ipf_path: str, file_infos: List[FileInfo], output_dir: str) -> bool:
        """
        Extract files using optimized approach - single ZIP file open with thread-safe access
        """
        print(f"Extracting {len(file_infos)} files using {self.max_workers} workers (optimized)...")

        self._total_count = len(file_infos)
        self._extracted_count = 0
        self._start_time = time.time()

        # Initialize progress logger for non-verbose mode
        if not self.verbose:
            self._progress_logger = ProgressLogger(len(file_infos), log_interval=2.0)

        # Prepare output paths and avoid conflicts
        extraction_tasks = []
        used_names = set()

        for file_info in file_infos:
            # Handle filename conflicts
            base_name = file_info.safe_name
            name, ext = os.path.splitext(base_name)
            counter = 1
            safe_name = base_name

            while safe_name in used_names:
                safe_name = f"{name}_{counter}{ext}"
                counter += 1

            used_names.add(safe_name)
            output_path = os.path.join(output_dir, safe_name)

            # Create a new FileInfo with the unique name
            unique_file_info = file_info._replace(safe_name=safe_name)
            extraction_tasks.append((unique_file_info, output_path, None))  # ZIP file will be added later

        # KEY OPTIMIZATION: Open the IPF file ONCE and share it safely
        try:
            with open(ipf_path, 'rb') as file:
                with zipfile.ZipFile(file) as ipf_zip:
                    # Update tasks with the shared ZipFile object
                    tasks_with_zip = [(task[0], task[1], ipf_zip) for task in extraction_tasks]

                    # Process files in parallel using the shared ZipFile
                    success_count = 0
                    total_size = 0

                    with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                        # Submit all tasks
                        future_to_task = {
                            executor.submit(self._extract_single_file_optimized, task): task
                            for task in tasks_with_zip
                        }

                        # Collect results
                        for future in as_completed(future_to_task):
                            success, filename, size = future.result()
                            if success:
                                success_count += 1
                                total_size += size
                                if self.verbose:
                                    print(f"✓ {filename} ({size} bytes)")

        except Exception as e:
            print(f"✗ Failed to process IPF file: {e}")
            return False

        # Final progress update
        elapsed = time.time() - self._start_time
        if self._progress_logger:
            self._progress_logger.finish_progress("File extraction")
        else:
            print(f"\n✓ Extraction completed in {elapsed:.1f} seconds!")

        print(f"  Successfully extracted: {success_count}/{len(file_infos)} files")
        print(f"  Total size: {total_size:,} bytes ({total_size/1024/1024:.1f} MB)")
        print(f"  Average speed: {len(file_infos)/elapsed:.1f} files/sec")

        return success_count == len(file_infos)

def process_ipf_file_optimized(ipf_path: str, output_dir: str = "extracted_optimized",
                             max_workers: Optional[int] = None, verbose: bool = False) -> bool:
    """
    Extract IPF file with optimized parallel processing
    """
    print(f"Processing '{ipf_path}' in optimized parallel mode...")

    if not os.path.exists(ipf_path):
        print(f"Error: IPF file not found: '{ipf_path}'")
        return False

    # Check file size and disk space
    file_size = os.path.getsize(ipf_path)
    try:
        import shutil
        stat = shutil.disk_usage(output_dir if os.path.exists(output_dir) else os.path.dirname(output_dir))
        if file_size > stat.free:
            print(f"❌ ERROR: Not enough disk space!")
            return False
    except:
        print("⚠️  Cannot check disk space availability")

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    try:
        # First pass: read all file info
        print("Reading IPF file structure...")
        with open(ipf_path, 'rb') as file:
            with zipfile.ZipFile(file) as ipf_zip:
                file_infos = ipf_zip.infolist()
                print(f"Found {len(file_infos)} files in archive")

        # Parallel filename decryption
        filename_processor = ParallelFilenameProcessor(max_workers, verbose=verbose)
        processed_files = filename_processor.process_all_filenames(ipf_path, file_infos)

        # Optimized parallel file extraction
        extractor = OptimizedParallelExtractor(max_workers, verbose=verbose)
        success = extractor.extract_files_optimized(ipf_path, processed_files, output_dir)

        print(f"\n✓ Optimized parallel extraction completed! Files saved to: {output_dir}")
        return True

    except Exception as e:
        print(f"✗ Failed to process IPF file: {e}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python ipf_extractor_optimized.py <file.ipf> [output_dir] [max_workers] [--verbose|-v]")
        print("\nThis tool extracts IPF files with optimized parallel filename decryption and extraction.")
        print("Optional max_workers parameter controls thread count (default: auto-detect)")
        print("Use --verbose or -v for detailed file-by-file logging")
        print("\nExamples:")
        print("  python ipf_extractor_optimized.py file.ipf")
        print("  python ipf_extractor_optimized.py file.ipf output 4")
        print("  python ipf_extractor_optimized.py file.ipf output 4 --verbose")
        sys.exit(1)

    ipf_file = sys.argv[1]
    output_dir = "extracted_optimized"
    max_workers = None
    verbose = False

    # Parse arguments
    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg in ['--verbose', '-v']:
            verbose = True
        elif arg.isdigit():
            max_workers = int(arg)
        else:
            output_dir = arg
        i += 1

    if max_workers and max_workers <= 0:
        print("Error: max_workers must be a positive integer")
        sys.exit(1)

    if not os.path.exists(ipf_file):
        print(f"Error: IPF file not found: '{ipf_file}'")
        sys.exit(1)

    success = process_ipf_file_optimized(ipf_file, output_dir, max_workers, verbose)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()