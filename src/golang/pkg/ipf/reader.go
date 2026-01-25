package ipf

import (
	"archive/zip"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"reflect"
)

// FileInfo represents a file within the IPF archive
type FileInfo struct {
	Index             int
	ZipInfo           *zip.File
	EncryptedFilename []byte
	DecryptedFilename string
	SafeFilename      string
	LocalHeaderOffset int64
	EncryptedNameLen  uint16
	HeaderSize        uint32
	ExtraLen          uint16
	ExtraField        []byte
	VersionNeeded     uint16
	VersionMadeBy     uint16
	GenPurpose        uint16
}

// IPFReader provides high-performance reading of IPF files
type IPFReader struct {
	File      *os.File
	ZipReader *zip.ReadCloser
	FileInfos []FileInfo
}

// NewIPFReader creates a new IPF reader for the given file path
func NewIPFReader(filename string) (*IPFReader, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to open IPF file: %w", err)
	}

	// Get file size for validation
	stat, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, fmt.Errorf("failed to get file stats: %w", err)
	}

	if stat.Size() == 0 {
		file.Close()
		return nil, fmt.Errorf("IPF file is empty")
	}

	// Create ZIP reader
	zipReader, err := zip.OpenReader(filename)
	if err != nil {
		file.Close()
		return nil, fmt.Errorf("failed to open ZIP reader: %w", err)
	}

	reader := &IPFReader{
		File:      file,
		ZipReader: zipReader,
		FileInfos: make([]FileInfo, 0, len(zipReader.File)),
	}

	return reader, nil
}

// ReadFileStructure reads the ZIP file structure and prepares file info
func (r *IPFReader) ReadFileStructure() error {
	r.FileInfos = r.FileInfos[:0] // Reset slice but keep capacity

	for i, zipFile := range r.ZipReader.File {
		// Use reflection to access unexported headerOffset field
		headerOffset := getHeaderOffset(zipFile)
		fileInfo := FileInfo{
			Index:             i,
			ZipInfo:           zipFile,
			LocalHeaderOffset: int64(headerOffset),
			SafeFilename:      fmt.Sprintf("file_%04d.bin", i), // Fallback name
		}
		r.FileInfos = append(r.FileInfos, fileInfo)
	}

	return nil
}

// ReadEncryptedFilenames reads encrypted filenames from local headers
// This is optimized to read all headers in a single pass
func (r *IPFReader) ReadEncryptedFilenames() error {
	// Get file size
	fileInfo, err := r.File.Stat()
	if err != nil {
		return fmt.Errorf("failed to get file size: %w", err)
	}
	fileSize := fileInfo.Size()

	// Use SectionReader for efficient random access
	mmap := io.NewSectionReader(r.File, 0, fileSize)

	for i := range r.FileInfos {
		headerOffset := r.FileInfos[i].LocalHeaderOffset

		// Seek to start of header
		_, err := mmap.Seek(headerOffset, io.SeekStart)
		if err != nil {
			continue
		}

		// Read first 30 bytes of local header
		headerBytes := make([]byte, 30)
		if _, err := io.ReadFull(mmap, headerBytes); err != nil {
			continue
		}

		// Parse version fields
		r.FileInfos[i].VersionNeeded = binary.LittleEndian.Uint16(headerBytes[4:6])
		r.FileInfos[i].GenPurpose = binary.LittleEndian.Uint16(headerBytes[6:8])

		// Parse filename and extra field lengths
		nameLen := binary.LittleEndian.Uint16(headerBytes[26:28])
		extraLen := binary.LittleEndian.Uint16(headerBytes[28:30])

		// Validate filename length
		if nameLen == 0 || nameLen > 512 {
			continue
		}

		// Check if header fits in file
		if headerOffset+30+int64(nameLen)+int64(extraLen) > fileSize {
			continue
		}

		// Read encrypted filename data
		encryptedName := make([]byte, nameLen)
		if _, err := io.ReadFull(mmap, encryptedName); err != nil {
			continue
		}

		// Update file info with encrypted filename data
		r.FileInfos[i].EncryptedFilename = encryptedName
		r.FileInfos[i].EncryptedNameLen = nameLen
		r.FileInfos[i].HeaderSize = uint32(30) + uint32(nameLen) + uint32(extraLen)

		// Read extra field data (if present)
		var extraField []byte
		if extraLen > 0 {
			extraField = make([]byte, extraLen)
			if _, err := io.ReadFull(mmap, extraField); err != nil {
				continue
			}
		}

		// Update file info with extra field data
		r.FileInfos[i].ExtraLen = extraLen
		r.FileInfos[i].ExtraField = extraField
	}

	return nil
}

// GetFileInfos returns all file information
func (r *IPFReader) GetFileInfos() []FileInfo {
	return r.FileInfos
}

// GetFileCount returns the number of files in the IPF
func (r *IPFReader) GetFileCount() int {
	return len(r.FileInfos)
}

// GetFileByIndex returns file info by index
func (r *IPFReader) GetFileByIndex(index int) (*FileInfo, error) {
	if index < 0 || index >= len(r.FileInfos) {
		return nil, fmt.Errorf("file index %d out of range (0-%d)", index, len(r.FileInfos)-1)
	}
	return &r.FileInfos[index], nil
}

// ExtractFile extracts a single file to the output directory
func (r *IPFReader) ExtractFile(fileInfo *FileInfo, outputDir string, password []byte) error {
	if fileInfo.ZipInfo == nil {
		return fmt.Errorf("file %d has no ZIP info", fileInfo.Index)
	}

	// Open the file from ZIP
	rc, err := fileInfo.ZipInfo.Open()
	if err != nil {
		return fmt.Errorf("failed to open file %d: %w", fileInfo.Index, err)
	}
	defer rc.Close()

	// Create output file path
	outputPath := fmt.Sprintf("%s/%s", outputDir, fileInfo.SafeFilename)

	// Create output file
	outFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create output file %s: %w", outputPath, err)
	}
	defer outFile.Close()

	// Copy file data (ZIP handles decryption automatically)
	_, err = io.Copy(outFile, rc)
	if err != nil {
		return fmt.Errorf("failed to copy file data for %s: %w", outputPath, err)
	}

	return nil
}

// Close closes the IPF reader and releases resources
func (r *IPFReader) Close() error {
	var firstErr error

	if r.ZipReader != nil {
		if err := r.ZipReader.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}

	if r.File != nil {
		if err := r.File.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}

	return firstErr
}

// getHeaderOffset uses reflection to access the unexported headerOffset field
func getHeaderOffset(f *zip.File) uint32 {
	// Use reflection to access the unexported headerOffset field
	v := reflect.ValueOf(f).Elem()
	field := v.FieldByName("headerOffset")
	if !field.IsValid() {
		return 0
	}
	// Handle both uint32 and int64 types
	switch field.Kind() {
	case reflect.Uint32, reflect.Uint, reflect.Uintptr:
		return uint32(field.Uint())
	case reflect.Int32, reflect.Int, reflect.Int64:
		return uint32(field.Int())
	default:
		return 0
	}
}

// GetFileSize returns the size of the IPF file
func (r *IPFReader) GetFileSize() (int64, error) {
	if r.File == nil {
		return 0, fmt.Errorf("file is not open")
	}

	stat, err := r.File.Stat()
	if err != nil {
		return 0, fmt.Errorf("failed to get file stats: %w", err)
	}

	return stat.Size(), nil
}

// GetTotalUncompressedSize returns the total uncompressed size of all files
func (r *IPFReader) GetTotalUncompressedSize() int64 {
	var total int64
	for _, fileInfo := range r.FileInfos {
		if fileInfo.ZipInfo != nil {
			total += int64(fileInfo.ZipInfo.UncompressedSize64)
		}
	}
	return total
}

// ValidateIPF performs basic validation of the IPF file structure
func (r *IPFReader) ValidateIPF() error {
	if len(r.FileInfos) == 0 {
		return fmt.Errorf("IPF file contains no files")
	}

	// Check if we have reasonable file counts and sizes
	fileCount := len(r.FileInfos)
	if fileCount > 1000000 {
		return fmt.Errorf("IPF file contains too many files: %d", fileCount)
	}

	// Validate local header offsets
	for i, fileInfo := range r.FileInfos {
		if fileInfo.LocalHeaderOffset < 0 {
			return fmt.Errorf("file %d has invalid header offset: %d", i, fileInfo.LocalHeaderOffset)
		}
	}

	return nil
}
