#!/usr/bin/env python3
"""
Hash Generation Script for Granado Espada IPF Tools

This script runs the original Windows tools (iz.exe, ez.exe) on test IPF files
and generates comprehensive hash databases for validation purposes.

USAGE:
    python generate_hashes.py [--ipf-path /path/to/ge/folder] [--output-dir ../testing/test_hashes]

REQUIREMENTS:
    - Windows: Native execution of iz.exe and ez.exe tools
    - Linux/Mac: Wine installed and configured
    - Original iz.exe and ez.exe tools
    - Test IPF files accessible
"""

import json
import hashlib
import os
import sys
import subprocess
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

class HashGenerator:
    def __init__(self, ipf_path=None, output_dir=None):
        # Default paths relative to script location
        script_dir = Path(__file__).parent.parent.parent
        self.ipf_path = Path(ipf_path) if ipf_path else script_dir / "testing/test_files"
        self.output_dir = Path(output_dir) if output_dir else script_dir / "testing/test_hashes"
        self.temp_dir = Path("temp_outputs")
        self.original_tools_dir = script_dir / "releases/original/bin"

        # Test file configurations
        self.test_files = {
            "small": {
                "name": "ai.ipf",
                "source": self.ipf_path / "ai.ipf"
            },
            "medium": {
                "name": "item_texture.ipf",
                "source": self.ipf_path / "item_texture.ipf"
            },
            "large": {
                "name": "ui.ipf",
                "source": self.ipf_path / "ui.ipf"
            }
        }

        # Ensure output directories exist
        self.temp_dir.mkdir(exist_ok=True)
        self.original_tools_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def calculate_file_hash(self, file_path):
        """Calculate SHA-256 hash of a file"""
        sha256_hash = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(chunk)
            return sha256_hash.hexdigest()
        except Exception as e:
            print(f"Error hashing {file_path}: {e}")
            return None

    def calculate_directory_hash(self, dir_path):
        """Calculate hash of files in directory using smart strategy"""
        if not os.path.exists(dir_path):
            return None

        # Collect all files first
        all_files = []
        total_size = 0

        for root, dirs, files in os.walk(dir_path):
            dirs.sort()  # Ensure consistent ordering
            for file in sorted(files):
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, dir_path)
                file_size = os.path.getsize(file_path)
                all_files.append((rel_path, file_path, file_size))
                total_size += file_size

        file_count = len(all_files)
        print(f"  Found {file_count} files, total size: {total_size}")

        # Apply smart strategy: full hashing for ≤30 files, sampling for >30 files
        if file_count <= 30:
            print("  Using full hashing strategy")
            return self._full_hashing_strategy(all_files, total_size)
        else:
            print(f"  Using sampling strategy for {file_count} files")
            return self._sampling_hashing_strategy(all_files, total_size)

    def _full_hashing_strategy(self, all_files, total_size):
        """Full file-by-file hashing for small collections"""
        file_hashes = {}

        for rel_path, file_path, file_size in all_files:
            file_hash = self.calculate_file_hash(file_path)
            if file_hash:
                file_hashes[rel_path] = {
                    "hash": file_hash,
                    "size": file_size
                }

        return {
            "strategy": "full",
            "file_count": len(file_hashes),
            "total_size": total_size,
            "files": file_hashes,
            "manifest_hash": hashlib.sha256(
                json.dumps(file_hashes, sort_keys=True).encode()
            ).hexdigest()
        }

    def _sampling_hashing_strategy(self, all_files, total_size):
        """Representative sampling for large collections"""
        import random

        file_hashes = {}

        # Deterministic sampling: grab from start, middle, and end
        if len(all_files) <= 15:
            # Take all files if there are fewer than 15
            sample_files = all_files
        else:
            # Take first 5 + middle 5 + last 5
            first_5 = all_files[:5]
            last_5 = all_files[-5:]

            # Calculate middle position and take 5 files from around it
            middle_index = len(all_files) // 2
            middle_start = middle_index - 2  # Take 2 before and 2 after middle
            middle_5 = all_files[middle_start:middle_start + 5]

            sample_files = first_5 + middle_5 + last_5

        for rel_path, file_path, file_size in sample_files:
            file_hash = self.calculate_file_hash(file_path)
            if file_hash:
                file_hashes[rel_path] = {
                    "hash": file_hash,
                    "size": file_size
                }

        return {
            "strategy": "sampling",
            "file_count": len(all_files),
            "total_size": total_size,
            "sampled_files": file_hashes,
            "sample_hash": hashlib.sha256(
                json.dumps(file_hashes, sort_keys=True).encode()
            ).hexdigest()
        }

    def run_iz_exe(self, ipf_path, output_zip_path):
        """Run iz.exe to convert IPF to password-protected ZIP"""
        print(f"Running iz.exe on {ipf_path}...")

        try:
            # iz.exe creates ZIP in same directory as IPF file
            ipf_dir = Path(ipf_path).parent
            ipf_name = Path(ipf_path).stem
            expected_zip = ipf_dir / f"{ipf_name}.zip"

            # Run iz.exe in the IPF directory
            iz_exe_absolute = (Path.cwd() / self.original_tools_dir / "iz.exe").resolve()

            # Choose execution method based on platform
            if os.name == 'nt':  # Windows
                cmd = [str(iz_exe_absolute), Path(ipf_path).name]
            else:  # Linux/Mac - use Wine
                cmd = ["wine", str(iz_exe_absolute), Path(ipf_path).name]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300, cwd=ipf_dir)

            if result.returncode != 0:
                print(f"iz.exe failed: {result.stderr}")
                return False, None, None

            # Look for generated ZIP file in IPF directory
            if expected_zip.exists():
                zip_hash = self.calculate_file_hash(expected_zip)
                zip_size = expected_zip.stat().st_size

                # Move to our output location
                output_zip_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(expected_zip), str(output_zip_path))

                return True, zip_hash, {
                    "output_size": zip_size
                }
            else:
                print("iz.exe did not generate expected ZIP file")
                return False, None, None

        except subprocess.TimeoutExpired:
            print("iz.exe timed out")
            return False, None, None
        except Exception as e:
            print(f"Error running iz.exe: {e}")
            return False, None, None

    def run_ez_exe(self, zip_path, output_dir):
        """Run ez.exe to extract password-protected ZIP"""
        print(f"Running ez.exe on {zip_path}...")

        try:
            # ez.exe extracts to same directory as ZIP file
            zip_dir = Path(zip_path).parent
            zip_name = Path(zip_path).stem
            extraction_dir = zip_dir / zip_name  # This is where ez.exe will create the output

            # Run ez.exe in the ZIP directory with simple relative paths (like manual)
            if os.name == 'nt':  # Windows
                cmd = ["ez.exe", zip_path.name]
            else:  # Linux/Mac - use Wine
                cmd = ["wine", "ez.exe", zip_path.name]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, cwd=zip_dir)

            # ez.exe sometimes produces warnings but succeeds, so check actual extraction
            if not extraction_dir.exists():
                print(f"ez.exe failed: no extraction directory created")
                if result.returncode != 0:
                    print(f"Return code: {result.returncode}, stderr: {result.stderr}")
                return False, None

            # Calculate hash of the extracted directory
            if extraction_dir.exists():
                dir_hash = self.calculate_directory_hash(extraction_dir)

                # Move extracted content to our output location
                output_dir.mkdir(parents=True, exist_ok=True)
                for item in extraction_dir.iterdir():
                    shutil.move(str(item), str(output_dir / item.name))
                extraction_dir.rmdir()

                return True, {
                    "directory_hash": dir_hash
                }
            else:
                print("ez.exe did not create expected extraction directory")
                return False, None

        except subprocess.TimeoutExpired:
            print("ez.exe timed out")
            return False, None
        except Exception as e:
            print(f"Error running ez.exe: {e}")
            return False, None

    def process_test_file(self, file_key, file_config):
        """Process a single test file through iz.exe + ez.exe pipeline"""
        print(f"\n=== Processing {file_config['name']} ===")

        # Find the IPF file
        ipf_source = Path(file_config['source'])
        if not ipf_source.exists():
            print(f"IPF file not found: {ipf_source}")
            return None

        # Setup paths
        ipf_name = Path(file_config['name']).stem
        temp_output_dir = self.temp_dir / f"{ipf_name}_extraction"
        zip_output = self.original_tools_dir / f"{ipf_name}.zip"

        # Clean up any existing outputs
        if zip_output.exists():
            zip_output.unlink()
        if temp_output_dir.exists():
            shutil.rmtree(temp_output_dir)

        results = {
            "test_file": file_config['name'],
            "ipf_size": ipf_source.stat().st_size,
            "ipf_hash": self.calculate_file_hash(ipf_source),
            "timestamp": datetime.now().isoformat()
        }

        # Step 1: Run iz.exe
        iz_success, zip_hash, iz_metrics = self.run_iz_exe(ipf_source, zip_output)
        if not iz_success:
            print(f"Failed to process {file_config['name']} with iz.exe")
            return None

        results["iz_exe"] = {
            "success": True,
            "output_zip_hash": zip_hash,
            **iz_metrics
        }

        # Step 2: Run ez.exe
        ez_success, ez_metrics = self.run_ez_exe(zip_output, temp_output_dir)
        if not ez_success:
            print(f"Failed to process {file_config['name']} with ez.exe")
            return None

        results["ez_exe"] = {
            "success": True,
            **ez_metrics
        }

        # Store extracted file hashes
        if ez_metrics and "directory_hash" in ez_metrics:
            results["extracted_files"] = ez_metrics["directory_hash"]

        print(f"Successfully processed {file_config['name']}")
        return results

    def generate_all_hashes(self):
        """Process all test files and generate hash database"""
        print("=== Granado Espada IPF Hash Generation ===")
        print(f"IPF search path: {self.ipf_path}")
        print(f"Output directory: {self.output_dir}")

        all_results = {}

        for file_key, file_config in self.test_files.items():
            result = self.process_test_file(file_key, file_config)
            if result:
                all_results[file_key] = result
            else:
                print(f"Failed to process {file_key}")

        # Save tool-specific extraction hashes (only one file needed)
        extraction_hashes = {
            "tool": "iz.exe + ez.exe extraction process",
            "purpose": "Reference hashes for IPF extraction validation",
            "generated_at": datetime.now().isoformat(),
            "test_files": {k: v for k, v in all_results.items()}
        }

        extraction_output = self.output_dir / "tools" / "extraction_hashes.json"
        extraction_output.parent.mkdir(exist_ok=True)
        with open(extraction_output, 'w') as f:
            json.dump(extraction_hashes, f, indent=2)

        print(f"\n=== Hash Generation Complete ===")
        print(f"Reference hashes saved to: {extraction_output}")
        print(f"Successfully processed {len(all_results)} test files")

        return extraction_hashes

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate reference hashes for IPF test files using original tools",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EXAMPLES:
    # Generate hashes using default paths
    python generate_hashes.py

    # Generate hashes with custom IPF files location
    python generate_hashes.py --ipf-path /path/to/ipf/files

    # Generate hashes with custom output directory
    python generate_hashes.py --output-dir /path/to/output

REQUIREMENTS:
    - Wine installed and configured
    - Original iz.exe and ez.exe tools in releases/original/bin/
    - Test IPF files in testing/test_files/
        """
    )
    parser.add_argument("--ipf-path",
                       help="Path to directory containing IPF test files (default: testing/test_files)")
    parser.add_argument("--output-dir",
                       help="Output directory for hash files (default: testing/test_hashes)")

    args = parser.parse_args()

    generator = HashGenerator(args.ipf_path, args.output_dir)

    print("=== Granado Espada IPF Hash Generation ===")
    print(f"IPF files location: {generator.ipf_path}")
    print(f"Output directory: {generator.output_dir}")
    print(f"Original tools: {generator.original_tools_dir}")
    print()

    try:
        generator.generate_all_hashes()
        print("\n✅ Hash generation completed successfully!")

        # Clean up temporary directory
        if generator.temp_dir.exists():
            try:
                shutil.rmtree(generator.temp_dir)
                print(f"🧹 Cleaned up temporary directory: {generator.temp_dir}")
            except Exception as cleanup_error:
                print(f"⚠️  Warning: Could not clean up temporary directory: {cleanup_error}")

    except KeyboardInterrupt:
        print("\n❌ Hash generation interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error during hash generation: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()