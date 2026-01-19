package ipf

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"sync/atomic"

	"github.com/joao-paulo-santos/GE-Library/pkg/workers"
	"github.com/joao-paulo-santos/GE-Library/pkg/zipcipher"
)

// DecryptionTask represents a filename decryption task
type DecryptionTask struct {
	Index             int
	EncryptedFilename []byte
	FallbackName      string
}

// DecryptionResult represents the result of decrypting a filename
type DecryptionResult struct {
	Index             int
	DecryptedFilename string
	SafeFilename      string
	Success           bool
}

// FilenameDecryptor handles parallel decryption of filenames
type FilenameDecryptor struct {
	password    []byte
	workerCount int
}

// NewFilenameDecryptor creates a new filename decryptor
func NewFilenameDecryptor(password []byte, workerCount int) *FilenameDecryptor {
	if workerCount <= 0 {
		workerCount = runtime.NumCPU()
	}

	return &FilenameDecryptor{
		password:    password,
		workerCount: workerCount,
	}
}

// DecryptSingle decrypts a single filename
func (fd *FilenameDecryptor) DecryptSingle(task DecryptionTask) DecryptionResult {
	if len(task.EncryptedFilename) == 0 {
		return DecryptionResult{
			Index:        task.Index,
			SafeFilename: task.FallbackName,
			Success:      false,
		}
	}

	// Decrypt filename
	decrypted, success := zipcipher.DecryptFilename(task.EncryptedFilename, fd.password)

	if !success {
		return DecryptionResult{
			Index:        task.Index,
			SafeFilename: task.FallbackName,
			Success:      false,
		}
	}

	// Create safe filename
	safeFilename := zipcipher.MakeSafeFilename(decrypted)
	if safeFilename == "" {
		safeFilename = task.FallbackName
	}

	return DecryptionResult{
		Index:             task.Index,
		DecryptedFilename: decrypted,
		SafeFilename:      safeFilename,
		Success:           success,
	}
}

// DecryptAllParallel decrypts all filenames using parallel processing
func (fd *FilenameDecryptor) DecryptAllParallel(ctx context.Context, fileInfos []FileInfo) ([]DecryptionResult, error) {
	if len(fileInfos) == 0 {
		return []DecryptionResult{}, nil
	}

	// Create decryption tasks
	tasks := make([]DecryptionTask, len(fileInfos))
	for i, fileInfo := range fileInfos {
		tasks[i] = DecryptionTask{
			Index:             i,
			EncryptedFilename: fileInfo.EncryptedFilename,
			FallbackName:      fileInfo.SafeFilename, // Use the fallback name
		}
	}

	// Create parallel processor
	processor := workers.NewParallelProcessor[DecryptionTask, DecryptionResult](
		fd.workerCount,
		len(tasks),
	)

	// Process all tasks in parallel
	results := processor.Process(ctx, tasks, fd.DecryptSingle)

	// Validate results
	if len(results) != len(fileInfos) {
		return nil, fmt.Errorf("result count mismatch: expected %d, got %d",
			len(fileInfos), len(results))
	}

	return results, nil
}

// DecryptResultProcessor handles processing and organizing decryption results
type DecryptResultProcessor struct {
	results      []DecryptionResult
	successCount int64
	totalCount   int
}

// NewDecryptResultProcessor creates a new result processor
func NewDecryptResultProcessor(expectedCount int) *DecryptResultProcessor {
	return &DecryptResultProcessor{
		results:    make([]DecryptionResult, expectedCount),
		totalCount: expectedCount,
	}
}

// ProcessResults organizes decryption results by their original indices
func (drp *DecryptResultProcessor) ProcessResults(results []DecryptionResult) {
	for _, result := range results {
		if result.Index >= 0 && result.Index < len(drp.results) {
			drp.results[result.Index] = result
			if result.Success {
				atomic.AddInt64(&drp.successCount, 1)
			}
		}
	}
}

// GetResults returns the processed results in original order
func (drp *DecryptResultProcessor) GetResults() []DecryptionResult {
	return drp.results
}

// GetSuccessCount returns the number of successfully decrypted filenames
func (drp *DecryptResultProcessor) GetSuccessCount() int64 {
	return atomic.LoadInt64(&drp.successCount)
}

// GetSuccessRate returns the success rate as a percentage
func (drp *DecryptResultProcessor) GetSuccessRate() float64 {
	if drp.totalCount == 0 {
		return 0.0
	}
	return float64(drp.successCount) / float64(drp.totalCount) * 100.0
}

// UpdateFileInfos updates the original FileInfo structs with decrypted names
func UpdateFileInfos(fileInfos []FileInfo, results []DecryptionResult) {
	for i, result := range results {
		if i < len(fileInfos) {
			fileInfos[i].DecryptedFilename = result.DecryptedFilename
			fileInfos[i].SafeFilename = result.SafeFilename
		}
	}
}

// DecryptFilenamesBatch decrypts filenames in batches for better memory management
func (fd *FilenameDecryptor) DecryptFilenamesBatch(ctx context.Context, fileInfos []FileInfo, batchSize int) ([]DecryptionResult, error) {
	if len(fileInfos) == 0 {
		return []DecryptionResult{}, nil
	}

	if batchSize <= 0 {
		batchSize = 1000 // Default batch size
	}

	// Process in batches
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Channel to collect all results
	allResults := make(chan DecryptionResult, len(fileInfos))
	var wg sync.WaitGroup

	// Process batches
	for i := 0; i < len(fileInfos); i += batchSize {
		end := i + batchSize
		if end > len(fileInfos) {
			end = len(fileInfos)
		}

		batch := fileInfos[i:end]
		tasks := make([]DecryptionTask, len(batch))

		for j, fileInfo := range batch {
			globalIndex := i + j
			tasks[j] = DecryptionTask{
				Index:             globalIndex,
				EncryptedFilename: fileInfo.EncryptedFilename,
				FallbackName:      fileInfo.SafeFilename,
			}
		}

		// Process batch
		wg.Add(1)
		go func(batchTasks []DecryptionTask) {
			defer wg.Done()
			for _, task := range batchTasks {
				result := fd.DecryptSingle(task)
				allResults <- result
			}
		}(tasks)
	}

	// Wait for all batches to complete
	go func() {
		wg.Wait()
		close(allResults)
	}()

	// Collect all results
	results := make([]DecryptionResult, len(fileInfos))
	for result := range allResults {
		if result.Index >= 0 && result.Index < len(results) {
			results[result.Index] = result
		}
	}

	return results, nil
}
