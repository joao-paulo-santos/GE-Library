#!/usr/bin/env python3
"""
IPF Extraction Validation Script

This script runs our compiled IPF extractor on test files and validates
the output against reference hashes using the generic validation framework.

USAGE:
    python validate_hashes.py [--ipf-path /path/to/project/root] [--verbose]

REQUIREMENTS:
    - Reference hashes in test_hashes/ directory
    - Test IPF files accessible in testing/test_files/
    - Compiled IPF extractor (src/golang/ipf-extractor)
"""

import json
import os
import sys
import tempfile
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
import argparse

# Import the generic validation framework
from tool_output_validator import ToolOutputValidator

class IPFExtractionValidator:
    """IPF Extraction specific validation using the generic framework"""

    def __init__(self, ipf_path=None, verbose=False):
        self.ipf_path = Path(ipf_path) if ipf_path else Path("../../ge")
        self.verbose = verbose
        self.test_hashes_dir = Path(__file__).parent / "test_hashes"
        self.temp_dir = Path("temp_validation")

        # Initialize the generic validator for extraction
        reference_hashes_path = self.test_hashes_dir / "tools" / "extraction_hashes.json"
        self.validator = ToolOutputValidator(str(reference_hashes_path), "extraction", verbose)

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

    def extract_with_compiled_tool(self, ipf_path, output_dir):
        """Extract using compiled IPF extractor"""
        go_exe = Path(__file__).parent.parent / "src" / "golang" / "build" / "ipf-extractor"
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
            "tool_type": "extraction",
            "timestamp": datetime.now().isoformat()
        }

        # Extract with our compiled tool
        print(f"Extracting with compiled tool...")
        success, message = self.extract_with_compiled_tool(ipf_source, temp_output_dir)

        if not success:
            print(f"Extraction failed: {message}")
            results["status"] = "extraction_failed"
            results["error"] = message
            return results

        # Use the generic validator to validate the extraction
        validation_result = self.validator.validate_extraction_output(temp_output_dir, file_key)

        # Merge results
        validation_result.update(results)

        return validation_result

    def validate_all_files(self):
        """Validate all test files"""
        print("=== Granado Espada IPF Extraction Validation ===")
        print(f"Tool type: extraction")
        print(f"IPF search path: {self.ipf_path}")
        print(f"Reference hashes: Available")

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
            else:
                print(f"  Status: {result['status']} - {result.get('reason', 'Unknown')}")

        # Generate summary
        summary = {
            "validation_summary": {
                "total_files_tested": total_count,
                "successful_validations": successful_count,
                "success_rate": successful_count / total_count if total_count > 0 else 0,
                "tool_type": "extraction",
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
                "file_count": result.get("our_output", {}).get("file_count"),
                "total_size": result.get("our_output", {}).get("total_size"),
                "perfect_match": result.get("perfect_match")
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

        print(f"\nDetailed report saved to: {report_file}")
        print("=" * 30)

        return summary

def main():
    parser = argparse.ArgumentParser(description="Validate compiled IPF extractor against reference hashes")
    parser.add_argument("--ipf-path", help="Path to Granado Espada GE folder (default: .)")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Show detailed validation output")

    args = parser.parse_args()

    validator = IPFExtractionValidator(args.ipf_path or ".", args.verbose)
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