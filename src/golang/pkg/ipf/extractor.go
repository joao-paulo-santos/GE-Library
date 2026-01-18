package ipf

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/ipf-extractor/ipf-extractor/pkg/workers"
	"github.com/ipf-extractor/ipf-extractor/pkg/zipcipher"
)

// ExtractionTask represents a file extraction task
type ExtractionTask struct {
	FileInfo   *FileInfo
	OutputDir  string
	ZipReader  *zip.ReadCloser
	Index      int
	Password   []byte
}

// ExtractionResult represents the result of extracting a file
type ExtractionResult struct {
	Index      int
	Success    bool
	FilePath   string
	Size       int64
	Error      error
	DurationMs int64
}

// ExtractionTiming holds timing information for extraction phases
type ExtractionTiming struct {
	IPFDecryption     time.Duration
	ExtractDecryption time.Duration
	IO               time.Duration
}

// ConcurrentExtractor handles parallel file extraction
type ConcurrentExtractor struct {
	reader      *IPFReader
	zipReader   *zip.ReadCloser
	workerCount int
}

// NewConcurrentExtractor creates a new concurrent extractor
func NewConcurrentExtractor(reader *IPFReader, zipReader *zip.ReadCloser, workerCount int) *ConcurrentExtractor {
	if workerCount <= 0 {
		workerCount = runtime.NumCPU()
	}

	return &ConcurrentExtractor{
		reader:      reader,
		zipReader:   zipReader,
		workerCount: workerCount,
	}
}

// ExtractSingle extracts a single file using custom ZIP decryption
func (ce *ConcurrentExtractor) ExtractSingle(task ExtractionTask) ExtractionResult {
	startTime := getTimeMillis()

	if task.FileInfo == nil || task.FileInfo.ZipInfo == nil {
		return ExtractionResult{
			Index:   task.Index,
			Success: false,
			Error:   fmt.Errorf("file %d has no ZIP info", task.Index),
		}
	}

	// Just use the output path directly - overwrite existing files
	finalPath := filepath.Join(task.OutputDir, task.FileInfo.SafeFilename)

	// Always use custom decryption for IPF files
	extractedData, err := ce.extractWithCustomDecryption(task)
	if err != nil {
		return ExtractionResult{
			Index:   task.Index,
			Success: false,
			Error:   fmt.Errorf("custom extraction failed: %w", err),
		}
	}

	// Write the extracted data
	return ce.writeExtractedData(extractedData, finalPath, task.Index, startTime)
}

// extractWithCustomDecryption extracts files using custom ZIP decryption without password verification
func (ce *ConcurrentExtractor) extractWithCustomDecryption(task ExtractionTask) ([]byte, error) {
	// Open the raw ZIP file for seeking
	zipFileHandle, err := os.Open(ce.reader.File.Name())
	if err != nil {
		return nil, fmt.Errorf("failed to open ZIP file handle: %w", err)
	}
	defer zipFileHandle.Close()

	// Seek to the local header offset
	_, err = zipFileHandle.Seek(task.FileInfo.LocalHeaderOffset, io.SeekStart)
	if err != nil {
		return nil, fmt.Errorf("failed to seek to file offset %d: %w", task.FileInfo.LocalHeaderOffset, err)
	}

	// Create custom encrypted file reader
	encryptedReader := zipcipher.NewEncryptedFileReader(zipFileHandle, task.Password)

	// Read and parse the local header
	header, err := encryptedReader.ReadLocalHeader()
	if err != nil {
		return nil, fmt.Errorf("failed to read local header: %w", err)
	}

	// Skip password verification and directly read compressed data
	compressedData, err := encryptedReader.ReadCompressedData()
	if err != nil {
		return nil, fmt.Errorf("failed to read compressed data: %w", err)
	}

	// If the file is encrypted, decrypt the data skipping the verification step
	if header.IsEncrypted() {
		if len(compressedData) < 12 {
			return nil, errors.New("encrypted data too short for encryption header")
		}

		// Initialize cipher with password
		ef := encryptedReader
		ef.InitCipher()

		// Decrypt and skip the 12-byte header
		headerBytes := compressedData[:12]
		ef.DecryptHeader(headerBytes) // Decrypt but don't verify

		// Decrypt the actual data
		actualData := compressedData[12:]
		decryptedData := ef.DecryptData(actualData)
		compressedData = decryptedData
	}

	// Decompress the data
	decompressedData, err := encryptedReader.DecompressData(compressedData)
	if err != nil {
		return nil, fmt.Errorf("failed to decompress data: %w", err)
	}

	return decompressedData, nil
}

// writeExtractedData writes extracted data to file
func (ce *ConcurrentExtractor) writeExtractedData(data []byte, finalPath string, index int, startTime int64) ExtractionResult {
	// Create parent directories if they don't exist
	parentDir := filepath.Dir(finalPath)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		return ExtractionResult{
			Index:   index,
			Success: false,
			Error:   fmt.Errorf("failed to create parent directory %s: %w", parentDir, err),
		}
	}

	outFile, err := os.OpenFile(finalPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return ExtractionResult{
			Index:   index,
			Success: false,
			Error:   fmt.Errorf("failed to create output file %s: %w", finalPath, err),
		}
	}
	defer outFile.Close()

	written, err := outFile.Write(data)
	if err != nil {
		os.Remove(finalPath) // Clean up partial file
		return ExtractionResult{
			Index:   index,
			Success: false,
			Error:   fmt.Errorf("failed to write file data for %s: %w", finalPath, err),
		}
	}

	// Ensure file is properly written and synced
	if err := outFile.Sync(); err != nil {
		os.Remove(finalPath) // Clean up partial file
		return ExtractionResult{
			Index:   index,
			Success: false,
			Error:   fmt.Errorf("failed to sync file %s: %w", finalPath, err),
		}
	}

	duration := getTimeMillis() - startTime

	return ExtractionResult{
		Index:      index,
		Success:    true,
		FilePath:   finalPath,
		Size:       int64(written),
		DurationMs: duration,
	}
}

// ExtractAllParallel extracts all files using parallel processing
func (ce *ConcurrentExtractor) ExtractAllParallel(ctx context.Context, outputDir string, password []byte) ([]ExtractionResult, error) {
	fileInfos := ce.reader.GetFileInfos()
	if len(fileInfos) == 0 {
		return []ExtractionResult{}, nil
	}

	// Ensure output directory exists
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	// Create extraction tasks
	tasks := make([]ExtractionTask, len(fileInfos))
	for i, fileInfo := range fileInfos {
		tasks[i] = ExtractionTask{
			FileInfo:  &fileInfo,
			OutputDir: outputDir,
			ZipReader: ce.zipReader,
			Index:     i,
			Password:  password,
		}
	}

	// Create parallel processor
	processor := workers.NewParallelProcessor[ExtractionTask, ExtractionResult](
		ce.workerCount,
		len(tasks),
	)

	// Process all tasks in parallel
	results := processor.Process(ctx, tasks, ce.ExtractSingle)

	return results, nil
}

// ExtractBatch extracts files in batches for better memory management
func (ce *ConcurrentExtractor) ExtractBatch(ctx context.Context, outputDir string, batchSize int, password []byte) ([]ExtractionResult, error) {
	// For simplicity, delegate to the main parallel extraction function
	return ce.ExtractAllParallel(ctx, outputDir, password)
}


// getTimeMillis returns current time in milliseconds
func getTimeMillis() int64 {
	return time.Now().UnixNano() / 1e6
}

// ExtractionStats provides statistics about extraction performance
type ExtractionStats struct {
	TotalFiles      int64
	ExtractedFiles  int64
	TotalSize       int64
	SuccessRate     float64
	AverageSpeedMBs float64
	Errors          []error
}

// CalculateStats calculates extraction statistics from results
func CalculateStats(results []ExtractionResult, durationMs int64) ExtractionStats {
	var extractedFiles, totalSize int64
	var errors []error

	for _, result := range results {
		if result.Success {
			extractedFiles++
			totalSize += result.Size
		} else if result.Error != nil {
			errors = append(errors, result.Error)
		}
	}

	totalFiles := int64(len(results))
	successRate := float64(extractedFiles) / float64(totalFiles) * 100.0

	// Calculate speed in MB/s
	var averageSpeedMBs float64
	if durationMs > 0 {
		averageSpeedMBs = float64(totalSize) / float64(durationMs) / 1024.0 / 1024.0 * 1000.0
	}

	return ExtractionStats{
		TotalFiles:      totalFiles,
		ExtractedFiles:  extractedFiles,
		TotalSize:       totalSize,
		SuccessRate:     successRate,
		AverageSpeedMBs: averageSpeedMBs,
		Errors:          errors,
	}
}

// GetTimings returns the current extraction timing information
func (ce *ConcurrentExtractor) GetTimings() ExtractionTiming {
	// Return zero timing since we're not tracking sub-phases accurately
	return ExtractionTiming{}
}