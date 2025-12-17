#!/usr/bin/env python3
"""
Results Validation CLI for Granado Espada IPF Tools

This script validates tool output against reference hashes without executing tools.
Designed for CI/CD pipeline integration and standalone validation.

USAGE:
    # Validate extraction output
    python validate_results.py --output ./extraction_dir --tool extraction --test-key small

    # Validate creation output
    python validate_results.py --output ./created.ipf --tool creation --test-key small_folder

    # Validate multiple outputs
    python validate_results.py --output-map '{"small": "./small_output", "medium": "./medium_output"}' --tool extraction

    # CI/CD mode with JSON output
    python validate_results.py --output ./results --tool extraction --test-key small --report-json validation_report.json

REQUIREMENTS:
    - Reference hashes in test_hashes/tools/{tool}_hashes.json (e.g., extraction_hashes.json)
    - Tool output (directory or files) to validate
"""

import json
import sys
import argparse
from pathlib import Path
import os

# Add the testing directory to path to import our validator
sys.path.insert(0, str(Path(__file__).parent))

from tool_output_validator import ToolOutputValidator


def parse_output_map(output_map_str):
    """Parse JSON output mapping string"""
    try:
        return json.loads(output_map_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in output-map: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Validate IPF tool output against reference hashes",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Validate single extraction output
  python validate_results.py --output ./ai_extraction --tool extraction --test-key small

  # Validate IPF creation output
  python validate_results.py --output ./new.ipf --tool creation --test-key small_folder

  # Validate multiple outputs
  python validate_results.py --output-map '{"small": "./small_out", "medium": "./med_out"}' --tool extraction

  # CI/CD integration
  python validate_results.py --output ./results --tool extraction --test-key small --report-json report.json --quiet
        """
    )

    # Input options (mutually exclusive)
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--output", "-o",
        help="Path to tool output (file or directory)"
    )
    input_group.add_argument(
        "--output-map", "-m",
        help="JSON mapping of test keys to output paths"
    )

    # Tool specification
    parser.add_argument(
        "--tool", "-t",
        choices=["extraction", "creation", "optimization", "conversion", "addition"],
        default="extraction",
        help="Type of tool output being validated (default: extraction)"
    )

    # Test specification (only needed for single output)
    parser.add_argument(
        "--test-key", "-k",
        help="Test key in reference hashes (small, medium, large, etc.)"
    )

    # Reference hashes
    parser.add_argument(
        "--reference", "-r",
        required=True,
        help="Path to reference hashes file (use test_hashes/tools/extraction_hashes.json for extraction)"
    )

    # Output options
    parser.add_argument(
        "--report-json",
        help="Path to write JSON validation report"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress console output (except errors)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable detailed validation output"
    )

    args = parser.parse_args()

    # Validate arguments
    if args.output and not args.test_key:
        parser.error("--test-key is required when using --output")

    if args.quiet and args.verbose:
        parser.error("--quiet and --verbose are mutually exclusive")

    # Setup paths
    script_dir = Path(__file__).parent
    reference_path = Path(args.reference)
    if not reference_path.is_absolute():
        reference_path = script_dir / reference_path

    # Initialize validator
    try:
        validator = ToolOutputValidator(
            str(reference_path),
            args.tool,
            verbose=args.verbose
        )
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    # Perform validation
    try:
        if args.output:
            # Single output validation
            if not args.quiet:
                print(f"Validating {args.tool} output: {args.output}")
                print(f"Test key: {args.test_key}")

            result = validator.validate_tool_output(args.output, args.test_key)

            # Create results structure for single validation
            results = {
                "summary": {
                    "validation_summary": {
                        "tool_type": args.tool,
                        "total_files_tested": 1 if result["status"] == "validation_complete" else 0,
                        "successful_validations": 1 if result.get("perfect_match", False) else 0,
                        "success_rate": 1.0 if result.get("perfect_match", False) else 0.0,
                        "timestamp": result.get("timestamp")
                    },
                    "results_summary": {
                        args.test_key: {
                            "tool_type": result.get("tool_type"),
                            "test_file": result.get("test_file"),
                            "status": result.get("status"),
                            "strategy": result.get("strategy"),
                            "perfect_match": result.get("perfect_match")
                        }
                    }
                },
                "detailed_results": {args.test_key: result}
            }

        else:
            # Multiple output validation
            output_mapping = parse_output_map(args.output_map)

            if not args.quiet:
                print(f"Validating {args.tool} outputs for {len(output_mapping)} test cases:")
                for key, path in output_mapping.items():
                    print(f"  {key}: {path}")

            results = validator.validate_multiple_outputs(output_mapping)

        # Display console results
        if not args.quiet:
            summary = results["summary"]["validation_summary"]
            success_rate = summary["success_rate"]

            print(f"\n=== VALIDATION RESULTS ===")
            print(f"Status: {'✅ PASSED' if success_rate == 1.0 else '❌ FAILED'}")
            print(f"Tool: {summary['tool_type']}")
            print(f"Files tested: {summary['total_files_tested']}")
            print(f"Successful: {summary['successful_validations']}")
            print(f"Success rate: {success_rate:.1%}")

            # Show individual results
            if len(results["summary"]["results_summary"]) > 1:
                print(f"\nIndividual results:")
                for test_key, result in results["summary"]["results_summary"].items():
                    status_symbol = "✅" if result.get("perfect_match") else "❌"
                    print(f"  {status_symbol} {test_key}: {result['status']}")

        # Write JSON report if requested
        if args.report_json:
            report_path = Path(args.report_json)
            validator.generate_report(results, report_path)
            if not args.quiet:
                print(f"\nDetailed report saved to: {report_path}")

        # Exit with appropriate code
        success_rate = results["summary"]["validation_summary"]["success_rate"]
        if success_rate == 1.0:
            sys.exit(0)
        else:
            sys.exit(1)

    except KeyboardInterrupt:
        print("\nValidation interrupted by user", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error during validation: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()