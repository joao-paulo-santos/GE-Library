"""
Test suite for IPF extractor functionality
Tests compare our extractor output against the reference files created by iz.exe + ez.exe
"""

import pytest
import sys
import os
import hashlib
from pathlib import Path

# Add the parent directory to sys.path so we can import our extractor
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from ipf_extractor import get_ipf_password, ZipCipher, decode_filename_from_local_header, process_ipf_file
except ImportError as e:
    pytest.skip(f"Cannot import ipf_extractor: {e}", allow_module_level=True)


class TestIPFExtractor:
    """Test class for IPF extractor functionality"""

    @pytest.fixture
    def test_data_dir(self):
        """Path to the testing_goals directory with reference files"""
        testing_goals = Path(__file__).parent.parent.parent / "testing_goals"
        return testing_goals

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
                    'size': file_path.stat().st_size,
                    'hash': calculate_file_hash(file_path)
                }
        return reference_files

    @pytest.fixture
    def test_ipf_file(self, test_data_dir):
        """Path to the test IPF file"""
        ipf_file = test_data_dir / "ai.ipf"
        if not ipf_file.exists():
            pytest.skip("Test IPF file not found")
        return ipf_file

    @pytest.fixture
    def test_zip_file(self, test_data_dir):
        """Path to the test ZIP file created by iz.exe"""
        zip_file = test_data_dir / "ai_iz_output.zip"
        if not zip_file.exists():
            pytest.skip("Test ZIP file not found")
        return zip_file


def calculate_file_hash(filepath):
    """Calculate SHA256 hash of a file"""
    hash_sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()


class TestZipCipher(TestIPFExtractor):
    """Test ZIP cipher functionality"""

    def test_zip_cipher_initialization(self):
        """Test that ZipCipher initializes correctly"""
        cipher = ZipCipher()
        assert hasattr(cipher, 'crc32_tab')
        assert len(cipher.crc32_tab) == 256

    def test_zip_cipher_key_initialization(self):
        """Test that cipher initializes keys with password"""
        cipher = ZipCipher()
        password = get_ipf_password()
        cipher.init_keys(password)

        # Keys should be initialized
        assert hasattr(cipher, 'keys')
        assert len(cipher.keys) == 3
        assert all(isinstance(key, int) for key in cipher.keys)

    def test_zip_cipher_decrypt_data(self):
        """Test data decryption functionality"""
        cipher = ZipCipher()
        password = get_ipf_password()
        cipher.init_keys(password)

        # Test basic decryption
        test_data = bytes([0x12, 0x34, 0x56])
        decrypted = cipher.decrypt_data(test_data)

        assert isinstance(decrypted, bytes)
        assert len(decrypted) == len(test_data)


class TestFilenameDecryption(TestIPFExtractor):
    """Test filename decryption functionality"""

    def test_decode_filename_from_local_header(self, test_ipf_file):
        """Test filename decryption from IPF local header"""
        # Read the ZIP structure to find file info
        import zipfile

        with zipfile.ZipFile(test_ipf_file, 'r') as zip_file:
            file_infos = zip_file.infolist()
            assert len(file_infos) > 0

            # Test filename decryption for first file
            first_file = file_infos[0]
            # Reopen file for filename reading (as our function expects a file handle)
            with open(test_ipf_file, 'rb') as file:
                decoded_name = decode_filename_from_local_header(file, first_file)

            # Should decode to a reasonable filename
            assert decoded_name is not None
            assert len(decoded_name) > 0
            assert all(32 <= ord(c) <= 126 or c in '._-/' for c in decoded_name)


class TestCompleteExtraction(TestIPFExtractor):
    """Test complete IPF extraction process"""

    def test_process_ipf_file_creates_output(self, test_ipf_file, tmp_path):
        """Test that process_ipf_file creates output directory and files"""
        output_dir = tmp_path / "test_output"

        # Run extraction
        success = process_ipf_file(str(test_ipf_file), str(output_dir))

        assert success is True
        assert output_dir.exists()
        assert output_dir.is_dir()

        # Should have created some files
        output_files = list(output_dir.glob("*"))
        assert len(output_files) > 0

    def test_extracted_files_match_reference(self, test_ipf_file, reference_files, tmp_path):
        """Test that extracted files exactly match reference files"""
        if not reference_files:
            pytest.skip("No reference files available")

        output_dir = tmp_path / "test_output"

        # Run extraction
        success = process_ipf_file(str(test_ipf_file), str(output_dir))
        assert success is True

        # Compare each reference file
        for ref_name, ref_info in reference_files.items():
            output_file = output_dir / ref_name

            # File should exist
            assert output_file.exists(), f"Output file {ref_name} not found"

            # Size should match
            assert output_file.stat().st_size == ref_info['size'], \
                f"Size mismatch for {ref_name}"

            # Hash should match
            output_hash = calculate_file_hash(output_file)
            assert output_hash == ref_info['hash'], \
                f"Hash mismatch for {ref_name}"

    def test_all_reference_files_accounted_for(self, test_ipf_file, reference_files, tmp_path):
        """Test that we extract exactly the same number of files as reference"""
        if not reference_files:
            pytest.skip("No reference files available")

        output_dir = tmp_path / "test_output"

        # Run extraction
        success = process_ipf_file(str(test_ipf_file), str(output_dir))
        assert success is True

        # Count output files
        output_files = [f for f in output_dir.glob("*") if f.is_file()]

        # Should have same number of files
        assert len(output_files) == len(reference_files), \
            f"File count mismatch: expected {len(reference_files)}, got {len(output_files)}"


if __name__ == "__main__":
    # Run tests directly
    pytest.main([__file__, "-v"])