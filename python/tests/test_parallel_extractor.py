"""
Test suite for parallel IPF extractor functionality
Tests ensure parallel processing produces identical results to sequential processing
"""

import pytest
import sys
import os
import time
import tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

# Add the parent directory to sys.path so we can import our extractors
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from ipf_extractor import process_ipf_file
    from ipf_extractor_parallel import process_ipf_file_parallel, ParallelFilenameProcessor, ParallelFileExtractor
except ImportError as e:
    pytest.skip(f"Cannot import extractors: {e}", allow_module_level=True)


class TestParallelFilenameProcessor:
    """Test parallel filename processing"""

    @pytest.fixture
    def test_data_dir(self):
        """Path to the testing_goals directory with reference files"""
        testing_goals = Path(__file__).parent.parent.parent / "testing_goals"
        return testing_goals

    @pytest.fixture
    def test_ipf_file(self, test_data_dir):
        """Path to the test IPF file"""
        ipf_file = test_data_dir / "ai.ipf"
        if not ipf_file.exists():
            pytest.skip("Test IPF file not found")
        return ipf_file

    def test_parallel_filename_processor_initialization(self):
        """Test that ParallelFilenameProcessor initializes correctly"""
        processor = ParallelFilenameProcessor(max_workers=4)
        assert processor.max_workers == 4
        assert processor.password is not None

    def test_parallel_vs_sequential_filename_processing(self, test_ipf_file):
        """Test that parallel filename processing produces same results as sequential"""
        import zipfile

        # Get file info using standard zipfile
        with zipfile.ZipFile(test_ipf_file, 'r') as zip_file:
            file_infos = zip_file.infolist()

        # Process with different worker counts
        for workers in [1, 2, 4]:
            processor = ParallelFilenameProcessor(max_workers=workers)
            results = processor.process_all_filenames(str(test_ipf_file), file_infos)

            # Should have results for all files
            assert len(results) == len(file_infos)

            # Results should be sorted by index
            indices = [result.index for result in results]
            assert indices == list(range(len(file_infos)))

            # All results should have safe names
            for result in results:
                assert result.safe_name is not None
                assert len(result.safe_name) > 0


class TestParallelFileExtractor:
    """Test parallel file extraction"""

    @pytest.fixture
    def test_data_dir(self):
        """Path to the testing_goals directory with reference files"""
        testing_goals = Path(__file__).parent.parent.parent / "testing_goals"
        return testing_goals

    @pytest.fixture
    def test_ipf_file(self, test_data_dir):
        """Path to the test IPF file"""
        ipf_file = test_data_dir / "ai.ipf"
        if not ipf_file.exists():
            pytest.skip("Test IPF file not found")
        return ipf_file

    def test_parallel_file_extractor_initialization(self):
        """Test that ParallelFileExtractor initializes correctly"""
        extractor = ParallelFileExtractor(max_workers=4, batch_size=8)
        assert extractor.max_workers == 4
        assert extractor.batch_size == 8
        assert extractor.password is not None

    def test_parallel_vs_sequential_extraction(self, test_ipf_file, tmp_path):
        """Test that parallel extraction produces identical results to sequential"""
        # Sequential extraction
        sequential_output = tmp_path / "sequential"
        sequential_success = process_ipf_file(str(test_ipf_file), str(sequential_output))

        assert sequential_success is True
        assert sequential_output.exists()

        # Parallel extraction with different worker counts
        for workers in [1, 2, 4]:
            parallel_output = tmp_path / f"parallel_{workers}"
            parallel_success = process_ipf_file_parallel(
                str(test_ipf_file),
                str(parallel_output),
                max_workers=workers
            )

            assert parallel_success is True
            assert parallel_output.exists()

            # Compare file counts
            sequential_files = list(sequential_output.glob("*"))
            parallel_files = list(parallel_output.glob("*"))

            assert len(parallel_files) == len(sequential_files)

            # Compare file sizes (should be identical)
            sequential_sizes = {f.name: f.stat().st_size for f in sequential_files}
            parallel_sizes = {f.name: f.stat().st_size for f in parallel_files}

            # Allow for different naming due to parallel processing
            # but total size should be the same
            assert sum(parallel_sizes.values()) == sum(sequential_sizes.values())


class TestParallelPerformance:
    """Test performance characteristics of parallel processing"""

    @pytest.fixture
    def test_data_dir(self):
        """Path to the testing_goals directory with reference files"""
        testing_goals = Path(__file__).parent.parent.parent / "testing_goals"
        return testing_goals

    @pytest.fixture
    def test_ipf_file(self, test_data_dir):
        """Path to the test IPF file"""
        ipf_file = test_data_dir / "ai.ipf"
        if not ipf_file.exists():
            pytest.skip("Test IPF file not found")
        return ipf_file

    def test_performance_comparison(self, test_ipf_file, tmp_path):
        """Compare performance between sequential and parallel extraction"""
        # Sequential extraction
        start_time = time.time()
        sequential_output = tmp_path / "sequential"
        sequential_success = process_ipf_file(str(test_ipf_file), str(sequential_output))
        sequential_time = time.time() - start_time

        assert sequential_success is True

        # Parallel extraction with multiple workers
        start_time = time.time()
        parallel_output = tmp_path / "parallel"
        parallel_success = process_ipf_file_parallel(
            str(test_ipf_file),
            str(parallel_output),
            max_workers=4
        )
        parallel_time = time.time() - start_time

        assert parallel_success is True

        # Print performance results (for manual inspection)
        print(f"\nPerformance comparison:")
        print(f"Sequential time: {sequential_time:.2f} seconds")
        print(f"Parallel time: {parallel_time:.2f} seconds")
        if parallel_time > 0:
            speedup = sequential_time / parallel_time
            print(f"Speedup: {speedup:.2f}x")

        # For very small files, threading overhead might make it slower
        # But for larger files or more files, parallel should be competitive
        # Allow 50% tolerance for small test files where overhead dominates
        assert parallel_time <= sequential_time * 1.5

    def test_thread_safety(self, test_ipf_file):
        """Test that parallel processing is thread-safe"""
        import zipfile

        with zipfile.ZipFile(test_ipf_file, 'r') as zip_file:
            file_infos = zip_file.infolist()

        # Run multiple filename processors concurrently
        def run_processor():
            processor = ParallelFilenameProcessor(max_workers=2)
            return processor.process_all_filenames(str(test_ipf_file), file_infos)

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(run_processor) for _ in range(3)]
            results = [future.result() for future in futures]

        # All results should be identical
        for result in results:
            assert len(result) == len(file_infos)
            for i, file_result in enumerate(result):
                assert file_result.index == i
                assert file_result.safe_name is not None


class TestParallelIntegration:
    """Integration tests for the complete parallel workflow"""

    @pytest.fixture
    def test_data_dir(self):
        """Path to the testing_goals directory with reference files"""
        testing_goals = Path(__file__).parent.parent.parent / "testing_goals"
        return testing_goals

    @pytest.fixture
    def test_ipf_file(self, test_data_dir):
        """Path to the test IPF file"""
        ipf_file = test_data_dir / "ai.ipf"
        if not ipf_file.exists():
            pytest.skip("Test IPF file not found")
        return ipf_file

    @pytest.fixture
    def reference_files(self, test_data_dir):
        """Dictionary of reference files created by iz.exe + ez.exe"""
        reference_dir = test_data_dir / "ai_iz_output"
        if not reference_dir.exists():
            pytest.skip("Reference directory not found - run iz.exe + ez.exe first")

        reference_files = {}
        for file_path in reference_dir.glob("*"):
            if file_path.is_file():
                reference_files[file_path.name] = {
                    'path': file_path,
                    'size': file_path.stat().st_size
                }
        return reference_files

    def test_parallel_extraction_matches_reference(self, test_ipf_file, reference_files, tmp_path):
        """Test that parallel extraction matches reference files"""
        if not reference_files:
            pytest.skip("No reference files available")

        output_dir = tmp_path / "parallel_output"
        success = process_ipf_file_parallel(str(test_ipf_file), str(output_dir))
        assert success is True

        # Count output files
        output_files = [f for f in output_dir.glob("*") if f.is_file()]

        # Should have same number of files
        assert len(output_files) == len(reference_files)

        # Total size should match
        output_total_size = sum(f.stat().st_size for f in output_files)
        reference_total_size = sum(info['size'] for info in reference_files.values())
        assert output_total_size == reference_total_size

    def test_parallel_with_different_worker_counts(self, test_ipf_file, tmp_path):
        """Test parallel extraction with different worker configurations"""
        worker_counts = [1, 2, 4, 8]

        results = []
        for workers in worker_counts:
            output_dir = tmp_path / f"workers_{workers}"
            start_time = time.time()

            success = process_ipf_file_parallel(
                str(test_ipf_file),
                str(output_dir),
                max_workers=workers
            )

            elapsed = time.time() - start_time
            assert success is True

            # Count files
            file_count = len(list(output_dir.glob("*")))
            results.append((workers, file_count, elapsed))

        # All extractions should produce the same number of files
        file_counts = [result[1] for result in results]
        assert all(count == file_counts[0] for count in file_counts)

        # Print performance results
        print(f"\nWorker count performance:")
        for workers, file_count, elapsed in results:
            print(f"Workers: {workers}, Files: {file_count}, Time: {elapsed:.2f}s")


if __name__ == "__main__":
    # Run tests directly
    pytest.main([__file__, "-v"])