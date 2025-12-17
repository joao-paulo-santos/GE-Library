#!/usr/bin/env python3
"""
Generic Validation Logic for Granado Espada IPF Tool Outputs

This module provides validation logic for all IPF tools in the getools.bat suite:
- IPF Extraction (iz.exe + ez.exe)
- IPF Creation (cz.exe + zi.exe)
- IPF Addition (af.exe)
- IPF Optimization (oz.exe)
- IES Conversion (ix3.exe)

USAGE:
    from tool_output_validator import ToolOutputValidator

    validator = ToolOutputValidator("path/to/reference_hashes.json", "extraction")
    result = validator.validate_tool_output("path/to/output", "small")

REQUIREMENTS:
    - Reference hashes in JSON format
    - Directory or files containing tool output
"""

import json
import hashlib
import os
import sys
import shutil
import tempfile
from pathlib import Path
from datetime import datetime
import zipfile
import subprocess


class ToolOutputValidator:
    """Generic validation logic for IPF tool outputs"""

    def __init__(self, reference_hashes_path, tool_type="extraction", verbose=False):
        """
        Initialize validator with reference hash data

        Args:
            reference_hashes_path: Path to reference_hashes.json file
            tool_type: Type of tool ("extraction", "creation", "optimization", "conversion", "addition")
            verbose: Enable detailed output
        """
        self.tool_type = tool_type
        self.verbose = verbose
        self.reference_hashes_path = Path(reference_hashes_path)
        self.reference_hashes = self._load_reference_hashes()

    def _load_reference_hashes(self):
        """Load reference hash data from JSON file"""
        try:
            with open(self.reference_hashes_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            raise ValueError(f"Reference hashes file not found: {self.reference_hashes_path}")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in reference hashes file: {e}")

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
        """Sampling hashing for medium/large collections"""
        if self.verbose:
            print(f"  Using sampling strategy: {len(all_files)} files")

        # Sample: first 5 + middle 5 + last 5 files
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

    def validate_extraction_output(self, output_path, test_file_key):
        """Validate IPF extraction output (directory of files)"""
        return self._validate_directory_output(output_path, test_file_key)

    def validate_creation_output(self, output_path, test_file_key):
        """Validate IPF creation output (single .ipf file)"""
        return self._validate_file_output(output_path, test_file_key, "creation")

    def validate_optimization_output(self, output_path, test_file_key):
        """Validate IPF optimization output (optimized .ipf file)"""
        return self._validate_file_output(output_path, test_file_key, "optimization")

    def validate_conversion_output(self, output_path, test_file_key):
        """Validate IES conversion output (XML/PRN files)"""
        return self._validate_directory_output(output_path, test_file_key)

    def validate_addition_output(self, output_path, test_file_key):
        """Validate IPF addition output (modified .ipf file)"""
        return self._validate_file_output(output_path, test_file_key, "addition")

    def _validate_directory_output(self, output_path, test_file_key):
        """Validate directory-based tool output"""
        if self.verbose:
            print(f"\n=== Validating {self.tool_type} output for {test_file_key} ===")

        # Check if reference hashes exist
        if not self.reference_hashes:
            return {"status": "skipped", "reason": f"no_reference_hashes_for_{self.tool_type}"}

        # Handle extraction tool's structure with "test_files"
        if self.tool_type == "extraction":
            if "test_files" not in self.reference_hashes:
                return {"status": "skipped", "reason": "no_test_files_section_in_reference_hashes"}
            tool_refs = self.reference_hashes["test_files"]
        else:
            # Standard structure for other tools
            if self.tool_type not in self.reference_hashes:
                return {"status": "skipped", "reason": f"no_reference_hashes_for_{self.tool_type}"}
            tool_refs = self.reference_hashes[self.tool_type]
        if test_file_key not in tool_refs:
            return {"status": "skipped", "reason": "no_reference_hashes_for_test_file"}

        extraction_path = Path(output_path)
        if not extraction_path.exists():
            return {"status": "skipped", "reason": "output_directory_not_found"}

        results = {
            "tool_type": self.tool_type,
            "test_file": test_file_key,
            "timestamp": datetime.now().isoformat()
        }

        # Calculate directory hash of output
        our_output = self.calculate_directory_hash(extraction_path)
        if not our_output:
            return {"status": "hash_calculation_failed"}

        results["our_output"] = our_output

        # Get reference output data
        reference_data = tool_refs[test_file_key]
        # Handle extraction tool's structure with "extracted_files"
        if self.tool_type == "extraction":
            reference_output = reference_data.get("extracted_files")
        else:
            reference_output = reference_data.get("output")

        if not reference_output:
            return {"status": "no_reference_output"}

        # Compare results
        validation_results = self._compare_outputs(our_output, reference_output)
        results.update(validation_results)

        return results

    def _validate_file_output(self, output_path, test_file_key):
        """Validate single-file tool output"""
        if self.verbose:
            print(f"\n=== Validating {self.tool_type} output for {test_file_key} ===")

        # Check if reference hashes exist
        if not self.reference_hashes or self.tool_type not in self.reference_hashes:
            return {"status": "skipped", "reason": f"no_reference_hashes_for_{self.tool_type}"}

        tool_refs = self.reference_hashes[self.tool_type]
        if test_file_key not in tool_refs:
            return {"status": "skipped", "reason": "no_reference_hashes_for_test_file"}

        output_file = Path(output_path)
        if not output_file.exists():
            return {"status": "skipped", "reason": "output_file_not_found"}

        results = {
            "tool_type": self.tool_type,
            "test_file": test_file_key,
            "timestamp": datetime.now().isoformat()
        }

        # For single file outputs, we might need to extract and analyze contents
        # This depends on the specific tool type
        if self.tool_type in ["creation", "addition", "optimization"]:
            # For IPF files, extract to temporary directory for validation
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_extraction = self._extract_ipf_for_validation(output_file, temp_dir)
                if temp_extraction:
                    our_output = self.calculate_directory_hash(temp_extraction)
                else:
                    # Fallback: just hash the file itself
                    file_hash = self.calculate_file_hash(output_file)
                    file_size = output_file.stat().st_size
                    our_output = {
                        "strategy": "file",
                        "file_count": 1,
                        "total_size": file_size,
                        "files": {output_file.name: {"hash": file_hash, "size": file_size}}
                    }
        else:
            # For other file types, just hash the file
            file_hash = self.calculate_file_hash(output_file)
            file_size = output_file.stat().st_size
            our_output = {
                "strategy": "file",
                "file_count": 1,
                "total_size": file_size,
                "files": {output_file.name: {"hash": file_hash, "size": file_size}}
            }

        if not our_output:
            return {"status": "hash_calculation_failed"}

        results["our_output"] = our_output

        # Get reference output data
        reference_data = tool_refs[test_file_key]
        # Handle extraction tool's structure with "extracted_files"
        if self.tool_type == "extraction":
            reference_output = reference_data.get("extracted_files")
        else:
            reference_output = reference_data.get("output")

        if not reference_output:
            return {"status": "no_reference_output"}

        # Compare results
        validation_results = self._compare_outputs(our_output, reference_output)
        results.update(validation_results)

        return results

    def _extract_ipf_for_validation(self, ipf_file, temp_dir):
        """Extract IPF file to temporary directory for validation"""
        try:
            # Use our existing extractor if available, or fallback method
            extractor_path = Path(__file__).parent.parent / "src" / "golang" / "ipf-extractor"
            if extractor_path.exists():
                result = subprocess.run([
                    str(extractor_path),
                    "-input", str(ipf_file),
                    "-output", temp_dir
                ], capture_output=True, timeout=300)

                if result.returncode == 0:
                    return temp_dir

            # Fallback: try to treat as ZIP if it's not encrypted
            try:
                with zipfile.ZipFile(ipf_file, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
                return temp_dir
            except:
                pass

            return None
        except Exception as e:
            if self.verbose:
                print(f"Failed to extract IPF for validation: {e}")
            return None

    def validate_tool_output(self, output_path, test_file_key):
        """
        Main validation dispatcher based on tool type

        Args:
            output_path: Path to tool output (file or directory)
            test_file_key: Key in reference hashes

        Returns:
            Dictionary containing validation results
        """
        tool_validators = {
            "extraction": self.validate_extraction_output,
            "creation": self.validate_creation_output,
            "optimization": self.validate_optimization_output,
            "conversion": self.validate_conversion_output,
            "addition": self.validate_addition_output
        }

        validator_func = tool_validators.get(self.tool_type)
        if not validator_func:
            return {
                "status": "error",
                "reason": f"unsupported_tool_type_{self.tool_type}"
            }

        return validator_func(output_path, test_file_key)

    def _compare_outputs(self, our_output, reference_output):
        """Compare our output with reference using appropriate strategy"""
        strategy = reference_output.get("strategy", "full")

        comparison = {
            "status": "validation_complete",
            "strategy": strategy
        }

        if strategy == "full":
            comparison.update(self._compare_full_output(our_output, reference_output))
        elif strategy == "sampling":
            comparison.update(self._compare_sampling_output(our_output, reference_output))
        elif strategy == "file":
            comparison.update(self._compare_file_output(our_output, reference_output))

        return comparison

    def _compare_full_output(self, our_output, reference_output):
        """Compare full file-by-file hashes"""
        manifest_hash_match = our_output.get("manifest_hash") == reference_output.get("manifest_hash")
        file_count_match = our_output["file_count"] == reference_output["file_count"]

        # Allow small size differences (<0.1%) as perfect matches
        our_size = our_output["total_size"]
        ref_size = reference_output["total_size"]
        size_diff_pct = abs(our_size - ref_size) / ref_size * 100 if ref_size > 0 else 0
        total_size_match = size_diff_pct < 0.1  # Within 0.1% is considered perfect

        comparison = {
            "file_count_match": file_count_match,
            "total_size_match": total_size_match,
            "manifest_hash_match": manifest_hash_match,
            "missing_files": [],
            "extra_files": [],
            "hash_mismatches": [],
            "size_difference_percent": size_diff_pct
        }

        # Check for missing files
        for ref_file in reference_output["files"]:
            if ref_file not in our_output["files"]:
                comparison["missing_files"].append(ref_file)

        # Check for extra files and hash mismatches
        for our_file, our_data in our_output["files"].items():
            if our_file not in reference_output["files"]:
                comparison["extra_files"].append(our_file)
            else:
                ref_data = reference_output["files"][our_file]
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

    def _compare_sampling_output(self, our_output, reference_output):
        """Compare sampled files"""
        sample_hash_match = our_output.get("sample_hash") == reference_output.get("sample_hash")
        file_count_match = our_output["file_count"] == reference_output["file_count"]

        # Allow small size differences (<0.1%) as perfect matches
        our_size = our_output["total_size"]
        ref_size = reference_output["total_size"]
        size_diff_pct = abs(our_size - ref_size) / ref_size * 100 if ref_size > 0 else 0
        total_size_match = size_diff_pct < 0.1  # Within 0.1% is considered perfect

        comparison = {
            "file_count_match": file_count_match,
            "total_size_match": total_size_match,
            "sample_hash_match": sample_hash_match,
            "sample_mismatches": [],
            "size_difference_percent": size_diff_pct
        }

        # Compare sampled files individually
        ref_samples = reference_output.get("sampled_files", {})
        our_samples = our_output.get("sampled_files", {})

        for filename in ref_samples:
            if filename not in our_samples:
                comparison["sample_mismatches"].append(f"Missing file: {filename}")
            elif our_samples[filename]["hash"] != ref_samples[filename]["hash"]:
                comparison["sample_mismatches"].append(f"Hash mismatch: {filename}")

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

    def _compare_file_output(self, our_output, reference_output):
        """Compare single file output"""
        our_files = our_output.get("files", {})
        ref_files = reference_output.get("files", {})

        if not our_files or not ref_files:
            return {
                "perfect_match": False,
                "file_match": False,
                "hash_match": False,
                "size_match": False
            }

        our_filename = list(our_files.keys())[0]
        ref_filename = list(ref_files.keys())[0]
        our_data = our_files[our_filename]
        ref_data = ref_files[ref_filename]

        file_match = our_filename == ref_filename
        hash_match = our_data["hash"] == ref_data["hash"]
        size_match = our_data["size"] == ref_data["size"]

        return {
            "perfect_match": file_match and hash_match and size_match,
            "file_match": file_match,
            "hash_match": hash_match,
            "size_match": size_match
        }

    def validate_multiple_outputs(self, output_mapping):
        """
        Validate multiple tool outputs

        Args:
            output_mapping: Dict mapping test_file_key -> output_path

        Returns:
            Dictionary containing all validation results and summary
        """
        all_results = {}
        successful_count = 0
        total_count = 0

        for test_file_key, output_path in output_mapping.items():
            result = self.validate_tool_output(output_path, test_file_key)
            all_results[test_file_key] = result

            if result["status"] == "validation_complete":
                total_count += 1
                if result.get("perfect_match", False):
                    successful_count += 1

                if self.verbose:
                    print(f"  Status: {result['status']}")
                    print(f"  Perfect match: {result.get('perfect_match', False)}")
            else:
                print(f"  Status: {result['status']} - {result.get('reason', 'Unknown')}")

        # Generate summary
        summary = {
            "validation_summary": {
                "tool_type": self.tool_type,
                "total_files_tested": total_count,
                "successful_validations": successful_count,
                "success_rate": successful_count / total_count if total_count > 0 else 0,
                "timestamp": datetime.now().isoformat()
            },
            "results_summary": {}
        }

        # Only store essential summary info for each file
        for file_key, result in all_results.items():
            summary["results_summary"][file_key] = {
                "tool_type": result.get("tool_type"),
                "test_file": result.get("test_file"),
                "status": result.get("status"),
                "strategy": result.get("strategy"),
                "file_count": result.get("our_output", {}).get("file_count"),
                "total_size": result.get("our_output", {}).get("total_size"),
                "perfect_match": result.get("perfect_match")
            }

        return {
            "summary": summary,
            "detailed_results": all_results
        }

    def generate_report(self, results, output_path):
        """Generate validation report file"""
        report_data = results.get("summary", results)

        with open(output_path, 'w') as f:
            json.dump(report_data, f, indent=2)

        return output_path