package zipcipher

import (
	"bytes"
	"compress/flate"
	"encoding/binary"
	"errors"
	"fmt"
	"hash/crc32"
	"io"
)

// ZIP file format constants
const localFileHeaderSignature = 0x04034b50
const dataDescriptorSignature = 0x08074b50
const centralDirSignature = 0x02014b50

// LocalFileHeader represents a ZIP local file header
type LocalFileHeader struct {
	Signature         uint32
	VersionNeeded     uint16
	BitFlag           uint16
	CompressionMethod uint16
	LastModTime       uint16
	LastModDate       uint16
	CRC32             uint32
	CompressedSize    uint32
	UncompressedSize  uint32
	FilenameLength    uint16
	ExtraFieldLength  uint16
	Filename          []byte
	ExtraField        []byte
}

// EncryptedFileReader provides reading and decryption of ZIP files with IPF passwords
type EncryptedFileReader struct {
	reader    io.ReadSeeker
	password  []byte
	cipher    *ZipCipher
	header    LocalFileHeader
	dataStart int64
}

// NewEncryptedFileReader creates a new reader for password-protected ZIP files
func NewEncryptedFileReader(reader io.ReadSeeker, password []byte) *EncryptedFileReader {
	return &EncryptedFileReader{
		reader:   reader,
		password: password,
		cipher:   &ZipCipher{},
	}
}

// ReadLocalHeader reads and parses the local file header
func (ef *EncryptedFileReader) ReadLocalHeader() (*LocalFileHeader, error) {
	headerBytes := make([]byte, 30) // Minimum header size
	_, err := io.ReadFull(ef.reader, headerBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to read local header: %w", err)
	}

	signature := binary.LittleEndian.Uint32(headerBytes[0:4])
	if signature != localFileHeaderSignature {
		return nil, fmt.Errorf("invalid local file header signature: 0x%08x", signature)
	}

	header := &LocalFileHeader{
		Signature:         signature,
		VersionNeeded:     binary.LittleEndian.Uint16(headerBytes[4:6]),
		BitFlag:           binary.LittleEndian.Uint16(headerBytes[6:8]),
		CompressionMethod: binary.LittleEndian.Uint16(headerBytes[8:10]),
		LastModTime:       binary.LittleEndian.Uint16(headerBytes[10:12]),
		LastModDate:       binary.LittleEndian.Uint16(headerBytes[12:14]),
		CRC32:             binary.LittleEndian.Uint32(headerBytes[14:18]),
		CompressedSize:    binary.LittleEndian.Uint32(headerBytes[18:22]),
		UncompressedSize:  binary.LittleEndian.Uint32(headerBytes[22:26]),
		FilenameLength:    binary.LittleEndian.Uint16(headerBytes[26:28]),
		ExtraFieldLength:  binary.LittleEndian.Uint16(headerBytes[28:30]),
	}

	// Read filename
	if header.FilenameLength > 0 {
		header.Filename = make([]byte, header.FilenameLength)
		_, err := io.ReadFull(ef.reader, header.Filename)
		if err != nil {
			return nil, fmt.Errorf("failed to read filename: %w", err)
		}
	}

	// Read extra field
	if header.ExtraFieldLength > 0 {
		header.ExtraField = make([]byte, header.ExtraFieldLength)
		_, err := io.ReadFull(ef.reader, header.ExtraField)
		if err != nil {
			return nil, fmt.Errorf("failed to read extra field: %w", err)
		}
	}

	ef.header = *header
	ef.dataStart = 30 + int64(header.FilenameLength) + int64(header.ExtraFieldLength)

	return header, nil
}

// IsEncrypted checks if the file is encrypted
func (ef *EncryptedFileReader) IsEncrypted() bool {
	return (ef.header.BitFlag & 0x1) != 0
}

// IsEncryptedHeader checks if the file is encrypted (method on LocalFileHeader)
func (lh *LocalFileHeader) IsEncrypted() bool {
	return (lh.BitFlag & 0x1) != 0
}

// ReadEncryptedData reads and decrypts the file data
func (ef *EncryptedFileReader) ReadEncryptedData() ([]byte, error) {
	if !ef.IsEncrypted() {
		// Not encrypted, read directly
		return ef.ReadCompressedData()
	}

	// For encrypted files, we need to read and decrypt the data
	compressedData, err := ef.ReadCompressedData()
	if err != nil {
		return nil, err
	}

	// Initialize cipher with password for data decryption
	ef.cipher.InitKeys(ef.password)

	// Skip the encryption header (first 12 bytes)
	if len(compressedData) < 12 {
		return nil, errors.New("encrypted data too short for encryption header")
	}

	// Verify the encryption header
	headerBytes := compressedData[:12]
	decryptedHeader := ef.cipher.DecryptData(headerBytes)

	// The last byte of the decrypted header should match the high byte of the file time
	expectedByte := byte(ef.header.LastModTime >> 8)
	if decryptedHeader[11] != expectedByte {
		// Try with alternate password interpretation
		return nil, fmt.Errorf("password verification failed (expected 0x%02x, got 0x%02x)",
			expectedByte, decryptedHeader[11])
	}

	// Decrypt the actual data
	actualData := compressedData[12:]
	decryptedData := ef.cipher.DecryptData(actualData)

	// Update CRC32 for verification if needed
	if ef.header.CRC32 != 0 {
		calculatedCRC := crc32.ChecksumIEEE(decryptedData)
		if calculatedCRC != ef.header.CRC32 {
			// This might be due to compression, so we'll check after decompression
		}
	}

	return decryptedData, nil
}

// ReadCompressedData reads the compressed data from the file
func (ef *EncryptedFileReader) ReadCompressedData() ([]byte, error) {
	if ef.header.CompressedSize == 0 {
		// Check for data descriptor
		return ef.readDataWithDescriptor()
	}

	compressedData := make([]byte, ef.header.CompressedSize)
	_, err := io.ReadFull(ef.reader, compressedData)
	if err != nil {
		return nil, fmt.Errorf("failed to read compressed data: %w", err)
	}

	return compressedData, nil
}

// readDataWithDescriptor reads data when size is stored in data descriptor
func (ef *EncryptedFileReader) readDataWithDescriptor() ([]byte, error) {
	// Read data until we find data descriptor signature
	var data bytes.Buffer
	buf := make([]byte, 4096)

	for {
		bytesRead, err := io.ReadAtLeast(ef.reader, buf, 1)
		if err != nil {
			return nil, fmt.Errorf("failed to read data: %w", err)
		}

		// Check for data descriptor signature
		if bytesRead >= 4 && binary.LittleEndian.Uint32(buf[bytesRead-4:bytesRead]) == dataDescriptorSignature {
			// Remove the signature from data
			data.Write(buf[:bytesRead-4])
			break
		}

		data.Write(buf[:bytesRead])
	}

	return data.Bytes(), nil
}

// DecompressData decompresses the read data based on compression method
func (ef *EncryptedFileReader) DecompressData(compressedData []byte) ([]byte, error) {
	switch ef.header.CompressionMethod {
	case 0: // No compression
		return compressedData, nil
	case 8: // Deflate
		return ef.decompressDeflate(compressedData)
	default:
		return nil, fmt.Errorf("unsupported compression method: %d", ef.header.CompressionMethod)
	}
}

// decompressDeflate decompresses deflate-compressed data
func (ef *EncryptedFileReader) decompressDeflate(compressedData []byte) ([]byte, error) {
	reader := flate.NewReader(bytes.NewReader(compressedData))
	defer reader.Close()

	decompressed, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("deflate decompression failed: %w", err)
	}

	// Verify CRC32 if available
	if ef.header.CRC32 != 0 {
		calculatedCRC := crc32.ChecksumIEEE(decompressed)
		if calculatedCRC != ef.header.CRC32 {
			return nil, fmt.Errorf("CRC32 mismatch: expected 0x%08x, got 0x%08x",
				ef.header.CRC32, calculatedCRC)
		}
	}

	// Verify size if available
	if ef.header.UncompressedSize != 0 && uint32(len(decompressed)) != ef.header.UncompressedSize {
		return nil, fmt.Errorf("size mismatch: expected %d, got %d",
			ef.header.UncompressedSize, len(decompressed))
	}

	return decompressed, nil
}

// ExtractFile performs a complete file extraction with decryption and decompression
func (ef *EncryptedFileReader) ExtractFile() ([]byte, error) {
	// Read encrypted data
	encryptedData, err := ef.ReadEncryptedData()
	if err != nil {
		return nil, fmt.Errorf("failed to read encrypted data: %w", err)
	}

	// Decompress the data
	decompressedData, err := ef.DecompressData(encryptedData)
	if err != nil {
		return nil, fmt.Errorf("failed to decompress data: %w", err)
	}

	return decompressedData, nil
}

// InitCipher initializes the cipher with the password
func (ef *EncryptedFileReader) InitCipher() {
	ef.cipher.InitKeys(ef.password)
}

// DecryptHeader decrypts the 12-byte encryption header without verification
func (ef *EncryptedFileReader) DecryptHeader(headerBytes []byte) {
	ef.cipher.DecryptData(headerBytes)
}

// DecryptData decrypts data using the current cipher state
func (ef *EncryptedFileReader) DecryptData(data []byte) []byte {
	return ef.cipher.DecryptData(data)
}
