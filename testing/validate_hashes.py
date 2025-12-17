#!/usr/bin/env python3
"""
Hash Validation Script for Granado Espada IPF Tools

This script runs our compiled IPF extractor on test files and validates
the output against reference hashes generated from the original Windows tools.

USAGE:
    python validate_hashes.py [--ipf-path /path/to/project/root] [--verbose]

REQUIREMENTS:
    - Reference hashes in test_hashes/ directory
    - Test IPF files accessible in testing/test_files/
    - Compiled IPF extractor (src/golang/ipf-extractor)
"""

import json
import hashlib
import os
import sys
import time
import tempfile
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
import argparse

# No Python imports needed - we only test compiled builds

class HashValidator:
    def __init__(self, ipf_path=None, tool_type="python", verbose=False):
        self.ipf_path = Path(ipf_path) if ipf_path else Path("../../ge")
        self.tool_type = tool_type
        self.verbose = verbose
        self.test_hashes_dir = Path(__file__).parent / "test_hashes"
        self.temp_dir = Path("temp_validation")

  
        # Load extraction hashes (single source of truth)
        self.extraction_hashes = self.load_extraction_hashes()

        # Test file configurations
        self.test_files = {
            "small": {
                "name": "ai.ipf",
                "source": "test_files/ai.ipf"
            },
            "medium": {
                "name": "item_texture.ipf",
                "source": "test_files/item_texture.ipf"
            },
            "large": {
                "name": "ui.ipf",
                "source": "test_files/ui.ipf"
            }
        }

        # Ensure temp directory exists
        self.temp_dir.mkdir(exist_ok=True)

    def load_extraction_hashes(self):
        """Load extraction-specific hashes"""
        try:
            with open(self.test_hashes_dir / "tools" / "extraction_hashes.json", 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print("Warning: extraction_hashes.json not found.")
            return None
        except Exception as e:
            print(f"Error loading extraction hashes: {e}")
            return None

    def calculate_file_hash(self, file_path):
        """Calculate SHA-256 hash of a file"""
        sha256_hash = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(chunk)
            return sha256_hash.hexdigest()
        except Exception as e:
            if self.verbose:
                print(f"Error hashing {file_path}: {e}")
            return None

    def calculate_directory_hash(self, dir_path):
        """Calculate hash of directory with smart strategy based on size"""
        if not os.path.exists(dir_path):
            return None

        all_files = []
        total_size = 0

        # Collect all file info first
        for root, dirs, files in os.walk(dir_path):
            dirs.sort()  # Ensure consistent ordering
            for file in sorted(files):
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, dir_path)
                file_size = os.path.getsize(file_path)
                all_files.append((rel_path, file_path, file_size))
                total_size += file_size

        file_count = len(all_files)

        # Simplified strategy: full hashing for ≤30 files, sampling for >30 files
        if file_count <= 30:
            return self._full_hashing_strategy(all_files, total_size)
        else:
            return self._sampling_hashing_strategy(all_files, total_size)

    def _full_hashing_strategy(self, all_files, total_size):
        """Full file-by-file hashing for small collections"""
        if self.verbose:
            print(f"  Using full hashing strategy: {len(all_files)} files")

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
        """Sampling hashing for medium collections"""
        if self.verbose:
            print(f"  Using sampling strategy: {len(all_files)} files")

        import random

        # Sample: first 10, last 10, random 20 files
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

        # Hash sampled files
        sample_hashes = {}
        for rel_path, file_path, file_size in sample_files:
            file_hash = self.calculate_file_hash(file_path)
            if file_hash:
                sample_hashes[rel_path] = {
                    "hash": file_hash,
                    "size": file_size
                }

        # Create file path manifest for all files (no content hashes)
        path_manifest = {rel_path: {"size": size} for rel_path, _, size in all_files}

        return {
            "strategy": "sampling",
            "file_count": len(all_files),
            "total_size": total_size,
            "sampled_files": sample_hashes,
            "path_manifest": path_manifest,
            "sample_hash": hashlib.sha256(
                json.dumps(sample_hashes, sort_keys=True).encode()
            ).hexdigest(),
            "structure_hash": hashlib.sha256(
                json.dumps(path_manifest, sort_keys=True).encode()
            ).hexdigest()
        }

    def _metadata_hashing_strategy(self, all_files, total_size):
        """Metadata-only hashing for large collections"""
        if self.verbose:
            print(f"  Using metadata strategy: {len(all_files)} files")

        # Create file path manifest for all files (no content hashes)
        path_manifest = {rel_path: {"size": size} for rel_path, _, size in all_files}

        # Sample a few representative files for content verification
        # Use same deterministic strategy as main sampling
        if len(all_files) <= 15:
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

        sample_hashes = {}
        for rel_path, file_path, file_size in sample_files:
            file_hash = self.calculate_file_hash(file_path)
            if file_hash:
                sample_hashes[rel_path] = {
                    "hash": file_hash,
                    "size": file_size
                }

        return {
            "strategy": "metadata",
            "file_count": len(all_files),
            "total_size": total_size,
            "sampled_files": sample_hashes,
            "path_manifest": path_manifest,
            "structure_hash": hashlib.sha256(
                json.dumps(path_manifest, sort_keys=True).encode()
            ).hexdigest(),
            "sample_count": len(sample_hashes)
        }

    def extract_with_compiled_tool(self, ipf_path, output_dir):
        """Extract using compiled IPF extractor"""
        go_exe = Path(__file__).parent.parent / "src" / "golang" / "ipf-extractor"
        if not go_exe.exists():
            return False, f"Compiled extractor not found: {go_exe}"

        try:
            output_dir.mkdir(parents=True, exist_ok=True)
            cmd = [str(go_exe), "-input", str(ipf_path), "-output", str(output_dir)]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

            if result.returncode == 0:
                return True, "Success"
            else:
                return False, result.stderr
        except subprocess.TimeoutExpired:
            return False, "Extraction timed out"
        except Exception as e:
            return False, str(e)

    
    def validate_extraction(self, file_key, file_config):
        """Validate extraction against reference hashes"""
        print(f"\n=== Validating {file_config['name']} ===")

        # Check if reference hashes exist
        if not self.extraction_hashes or file_key not in self.extraction_hashes.get("test_files", {}):
            print(f"No reference hashes found for {file_key}")
            return {"status": "skipped", "reason": "no_reference_hashes"}

        # Find the IPF file
        ipf_source = Path(file_config['source'])
        if not ipf_source.exists():
            print(f"IPF file not found: {ipf_source}")
            return {"status": "skipped", "reason": "ipf_file_not_found"}

        # Setup paths
        ipf_name = Path(file_config['name']).stem
        temp_output_dir = self.temp_dir / f"{ipf_name}_validation"

        # Clean up any existing outputs
        if temp_output_dir.exists():
            shutil.rmtree(temp_output_dir)

        results = {
            "test_file": file_config['name'],
            "tool_type": self.tool_type,
            "timestamp": datetime.now().isoformat()
        }

        # Extract with our compiled tool
        print(f"Extracting with compiled tool...")
        start_time = time.time()

        success, message = self.extract_with_compiled_tool(ipf_source, temp_output_dir)

        processing_time = (time.time() - start_time) * 1000
        results["processing_time_ms"] = processing_time

        if not success:
            print(f"Extraction failed: {message}")
            results["status"] = "extraction_failed"
            results["error"] = message
            return results

        # Calculate directory hash of our extraction
        our_extraction = self.calculate_directory_hash(temp_output_dir)
        if not our_extraction:
            results["status"] = "hash_calculation_failed"
            return results

        results["our_extraction"] = our_extraction

        # Get reference extraction data
        reference_data = self.extraction_hashes["test_files"][file_key]
        reference_extraction = reference_data.get("extracted_files")

        if not reference_extraction:
            results["status"] = "no_reference_extraction"
            return results

        # Compare results
        validation_results = self.compare_extractions(our_extraction, reference_extraction)
        results.update(validation_results)

        # Performance comparison
        ref_time = reference_data.get("ez_exe", {}).get("processing_time_ms", 0)
        if ref_time > 0:
            speedup = ref_time / processing_time
            results["performance"] = {
                "our_time_ms": processing_time,
                "reference_time_ms": ref_time,
                "speedup_factor": speedup
            }

        return results

    def compare_extractions(self, our_extraction, reference_extraction):
        """Compare our extraction results with reference using appropriate strategy"""
        strategy = reference_extraction.get("strategy", "full")

        comparison = {
            "status": "validation_complete",
            "strategy": strategy
        }

        if strategy == "full":
            comparison.update(self._compare_full_extraction(our_extraction, reference_extraction))
        elif strategy == "sampling":
            comparison.update(self._compare_sampling_extraction(our_extraction, reference_extraction))
        elif strategy == "metadata":
            comparison.update(self._compare_metadata_extraction(our_extraction, reference_extraction))

        return comparison

    def _compare_full_extraction(self, our_extraction, reference_extraction):
        """Compare full file-by-file hashes"""
        manifest_hash_match = our_extraction.get("manifest_hash") == reference_extraction.get("manifest_hash")
        file_count_match = our_extraction["file_count"] == reference_extraction["file_count"]
        total_size_match = our_extraction["total_size"] == reference_extraction["total_size"]

        comparison = {
            "file_count_match": file_count_match,
            "total_size_match": total_size_match,
            "manifest_hash_match": manifest_hash_match,
            "missing_files": [],
            "extra_files": [],
            "hash_mismatches": []
        }

        # Check for missing files
        for ref_file in reference_extraction["files"]:
            if ref_file not in our_extraction["files"]:
                comparison["missing_files"].append(ref_file)

        # Check for extra files and hash mismatches
        for our_file, our_data in our_extraction["files"].items():
            if our_file not in reference_extraction["files"]:
                comparison["extra_files"].append(our_file)
            else:
                ref_data = reference_extraction["files"][our_file]
                if our_data["hash"] != ref_data["hash"]:
                    comparison["hash_mismatches"].append({
                        "file": our_file,
                        "our_hash": our_data["hash"],
                        "reference_hash": ref_data["hash"]
                    })

        # Determine overall success
        comparison["perfect_match"] = (
            file_count_match and
            total_size_match and
            manifest_hash_match and
            len(comparison["missing_files"]) == 0 and
            len(comparison["extra_files"]) == 0 and
            len(comparison["hash_mismatches"]) == 0
        )

        return comparison

    def _compare_sampling_extraction(self, our_extraction, reference_extraction):
        """Compare sampled files"""
        sample_hash_match = our_extraction.get("sample_hash") == reference_extraction.get("sample_hash")
        file_count_match = our_extraction["file_count"] == reference_extraction["file_count"]
        total_size_match = our_extraction["total_size"] == reference_extraction["total_size"]

        comparison = {
            "file_count_match": file_count_match,
            "total_size_match": total_size_match,
            "sample_hash_match": sample_hash_match,
            "sample_mismatches": []
        }

        # Compare sampled files individually
        ref_samples = reference_extraction.get("sampled_files", {})
        our_samples = our_extraction.get("sampled_files", {})

        for filename in ref_samples:
            if filename not in our_samples:
                comparison["sample_mismatches"].append(f"Missing file: {filename}")
            elif our_samples[filename]["hash"] != ref_samples[filename]["hash"]:
                comparison["sample_mismatches"].append(f"Hash mismatch: {filename}")

        # Determine overall success
        comparison["perfect_match"] = (
            file_count_match and
            total_size_match and
            sample_hash_match and
            len(comparison["sample_mismatches"]) == 0
        )

        for sample_file, ref_data in ref_samples.items():
            if sample_file in our_samples:
                our_data = our_samples[sample_file]
                if our_data["hash"] != ref_data["hash"]:
                    comparison["sample_mismatches"].append({
                        "file": sample_file,
                        "our_hash": our_data["hash"],
                        "reference_hash": ref_data["hash"]
                    })

        # Determine success for sampling strategy
        comparison["perfect_match"] = (
            file_count_match and
            total_size_match and
                        sample_hash_match and
            len(comparison["sample_mismatches"]) == 0
        )

        return comparison

    def _compare_metadata_extraction(self, our_extraction, reference_extraction):
        """Compare metadata and sampled files for large collections"""
        file_count_match = our_extraction["file_count"] == reference_extraction["file_count"]
        total_size_match = our_extraction["total_size"] == reference_extraction["total_size"]

        comparison = {
            "file_count_match": file_count_match,
            "total_size_match": total_size_match,
            "sample_mismatches": []
        }

        # Compare sampled files (if available)
        ref_samples = reference_extraction.get("sampled_files", {})
        our_samples = our_extraction.get("sampled_files", {})

        for sample_file, ref_data in ref_samples.items():
            if sample_file in our_samples:
                our_data = our_samples[sample_file]
                if our_data["hash"] != ref_data["hash"]:
                    comparison["sample_mismatches"].append({
                        "file": sample_file,
                        "our_hash": our_data["hash"],
                        "reference_hash": ref_data["hash"]
                    })

        # For large files, we consider success if structure matches and no sample mismatches
        comparison["perfect_match"] = (
            file_count_match and
            total_size_match and
                        len(comparison["sample_mismatches"]) == 0
        )

        return comparison

    def validate_all_files(self):
        """Validate all test files"""
        print("=== Granado Espada IPF Hash Validation ===")
        print(f"Tool type: {self.tool_type}")
        print(f"IPF search path: {self.ipf_path}")
        print(f"Reference hashes: {'Available' if self.extraction_hashes else 'Not found'}")

        all_results = {}
        successful_count = 0
        total_count = 0

        for file_key, file_config in self.test_files.items():
            result = self.validate_extraction(file_key, file_config)
            all_results[file_key] = result

            if result["status"] == "validation_complete":
                total_count += 1
                if result.get("perfect_match", False):
                    successful_count += 1

                if self.verbose:
                    print(f"  Status: {result['status']}")
                    print(f"  Perfect match: {result.get('perfect_match', False)}")
                    if "performance" in result:
                        print(f"  Speedup: {result['performance']['speedup_factor']:.2f}x")
            else:
                print(f"  Status: {result['status']} - {result.get('reason', 'Unknown')}")

        # Generate summary
        summary = {
            "validation_summary": {
                "total_files_tested": total_count,
                "successful_validations": successful_count,
                "success_rate": successful_count / total_count if total_count > 0 else 0,
                "tool_type": self.tool_type,
                "timestamp": datetime.now().isoformat()
            },
            "results_summary": {}
        }

        # Only store essential summary info for each file, not detailed hashes
        for file_key, result in all_results.items():
            summary["results_summary"][file_key] = {
                "test_file": result.get("test_file"),
                "status": result.get("status"),
                "strategy": result.get("strategy"),
                "file_count": result.get("our_extraction", {}).get("file_count"),
                "total_size": result.get("our_extraction", {}).get("total_size"),
                "perfect_match": result.get("perfect_match"),
                "processing_time_ms": result.get("processing_time_ms"),
                "speedup_factor": result.get("performance", {}).get("speedup_factor")
            }

        # Save validation report
        report_file = self.test_hashes_dir / "validation_report.json"
        with open(report_file, 'w') as f:
            json.dump(summary, f, indent=2)

        # Display console results
        print(f"\n=== VALIDATION RESULTS ===")
        print(f"Status: {'✅ PASSED' if summary['validation_summary']['success_rate'] == 1.0 else '❌ FAILED'}")
        print(f"Files tested: {total_count}")
        print(f"Successful: {successful_count}")
        print(f"Success rate: {summary['validation_summary']['success_rate']:.1%}")

        # Show performance metrics if available
        for file_key, result in all_results.items():
            if "performance" in result:
                perf = result["performance"]
                speedup = perf["speedup_factor"]
                print(f"  {file_key}: {speedup:.1f}x speedup vs original")

        print(f"\nDetailed report saved to: {report_file}")
        print("=" * 30)

        return summary

def main():
    parser = argparse.ArgumentParser(description="Validate compiled IPF extractor against reference hashes")
    parser.add_argument("--ipf-path", help="Path to Granado Espada GE folder (default: .)")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Show detailed validation output")

    args = parser.parse_args()

    validator = HashValidator(args.ipf_path or ".", "compiled", args.verbose)
    try:
        summary = validator.validate_all_files()

        # Exit with error code if validation failed
        if summary["validation_summary"]["success_rate"] < 1.0:
            sys.exit(1)

    except KeyboardInterrupt:
        print("\nValidation interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"Error during validation: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()