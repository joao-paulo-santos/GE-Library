package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/joao-paulo-santos/GE-Library/pkg/ipf"
	"github.com/joao-paulo-santos/GE-Library/pkg/zipcipher"
)

const (
	// Version information
	AppName    = "IPF Extractor"
	AppVersion = "1.0.0"
	AppDesc    = "High-performance IPF archive extractor using Go"
)

// Config holds the application configuration
type Config struct {
	InputFile    string
	OutputDir    string
	WorkerCount  int
	BatchSize    int
	Verbose      bool
	Quiet        bool
	ShowVersion  bool
	ShowProgress bool
	ValidateOnly bool
	MaxMemory    int64 // Maximum memory usage in MB
}

func main() {
	config := parseFlags()

	if config.ShowVersion {
		printVersion()
		return
	}

	if config.InputFile == "" {
		printUsage()
		os.Exit(1)
	}

	// Validate input file
	if err := validateInput(config.InputFile); err != nil {
		log.Fatalf("Error: %v", err)
	}

	// Run extraction
	if err := runExtraction(config); err != nil {
		log.Fatalf("Extraction failed: %v", err)
	}
}

// parseFlags parses command line flags
func parseFlags() *Config {
	config := &Config{}

	flag.StringVar(&config.InputFile, "input", "", "Input IPF file path")
	flag.StringVar(&config.OutputDir, "output", "extracted", "Output directory")
	flag.IntVar(&config.WorkerCount, "workers", 0, "Number of worker threads (0 = auto-detect)")
	flag.IntVar(&config.BatchSize, "batch", 1000, "Batch size for processing")
	flag.BoolVar(&config.Verbose, "verbose", false, "Enable verbose output")
	flag.BoolVar(&config.Quiet, "quiet", false, "Suppress all output except errors")
	flag.BoolVar(&config.ShowVersion, "version", false, "Show version information")
	flag.BoolVar(&config.ShowProgress, "progress", true, "Show progress bar")
	flag.BoolVar(&config.ValidateOnly, "validate", false, "Only validate IPF file, don't extract")
	flag.Int64Var(&config.MaxMemory, "max-memory", 0, "Maximum memory usage in MB (0 = no limit)")

	flag.Parse()

	// Auto-detect worker count if not specified
	if config.WorkerCount <= 0 {
		config.WorkerCount = runtime.NumCPU()
		if config.WorkerCount > 32 {
			config.WorkerCount = 32 // Cap at 32 for optimal performance
		}
	}

	// Set output directory if not specified
	if config.OutputDir == "" {
		config.OutputDir = "extracted"
	}

	// Adjust batch size based on system
	if config.BatchSize <= 0 {
		if runtime.NumCPU() > 16 {
			config.BatchSize = 2000
		} else {
			config.BatchSize = 1000
		}
	}

	return config
}

// printUsage prints usage information
func printUsage() {
	fmt.Printf(`
%s v%s - %s

Usage: %s [options] <input.ipf>

Options:
  -input <file>      Input IPF file path
  -output <dir>      Output directory (default: extracted)
  -workers <n>       Number of worker threads (default: auto-detect)
  -batch <n>         Batch size for processing (default: 1000)
  -verbose          Enable verbose output
  -quiet            Suppress all output except errors
  -progress         Show progress bar (default: true)
  -validate         Only validate IPF file, don't extract
  -max-memory <mb>  Maximum memory usage in MB (default: no limit)
  -version          Show version information

Examples:
  # Extract with default settings
  %s -input archive.ipf -output extracted_files

  # Use all CPU cores with verbose output
  %s -input archive.ipf -workers 0 -verbose

  # Validate only, don't extract
  %s -input archive.ipf -validate

  # Large archive with more workers and larger batch
  %s -input large_archive.ipf -workers 32 -batch 2000

`, AppName, AppVersion, AppDesc, os.Args[0], os.Args[0], os.Args[0], os.Args[0], os.Args[0])
}

// printVersion prints version information
func printVersion() {
	fmt.Printf("%s v%s\n", AppName, AppVersion)
	fmt.Printf("%s\n", AppDesc)
	fmt.Printf("Built with Go %s\n", runtime.Version())
	fmt.Printf("System: %s/%s, CPUs: %d\n", runtime.GOOS, runtime.GOARCH, runtime.NumCPU())
	fmt.Printf("\nUsage: %s -input <file.ipf> [options]\n", os.Args[0])
	fmt.Printf("For detailed help: %s -help\n", os.Args[0])
}

// validateInput validates the input file
func validateInput(inputFile string) error {
	if _, err := os.Stat(inputFile); os.IsNotExist(err) {
		return fmt.Errorf("input file does not exist: %s", inputFile)
	}

	// Check if file is readable
	file, err := os.Open(inputFile)
	if err != nil {
		return fmt.Errorf("cannot open input file: %w", err)
	}
	file.Close()

	// Check file extension (optional)
	ext := strings.ToLower(filepath.Ext(inputFile))
	if ext != ".ipf" {
		fmt.Printf("Warning: Input file does not have .ipf extension: %s\n", inputFile)
		fmt.Printf("         IPF files typically have .ipf extension, but continuing anyway...\n")
	}

	return nil
}

// runExtraction runs the main extraction process
func runExtraction(config *Config) error {
	ctx := context.Background()
	totalStartTime := time.Now()

	// Print header
	if !config.Quiet {
		fmt.Printf("%s v%s\n", AppName, AppVersion)
		fmt.Printf("Input: %s\n", config.InputFile)
		fmt.Printf("Output: %s\n", config.OutputDir)
		fmt.Printf("Workers: %d\n", config.WorkerCount)
		fmt.Printf("Batch Size: %d\n", config.BatchSize)
		fmt.Printf("\n")
	}

	// Phase timing variables
	var ipfReadTime, filenameReadTime, decryptTime, extractTime time.Duration

	// Step 1: Open IPF file
	printStep(config, "Reading IPF file structure...")
	ipfStart := time.Now()
	reader, err := ipf.NewIPFReader(config.InputFile)
	if err != nil {
		return fmt.Errorf("failed to open IPF file: %w", err)
	}
	defer reader.Close()

	// Step 2: Read file structure
	if err := reader.ReadFileStructure(); err != nil {
		return fmt.Errorf("failed to read file structure: %w", err)
	}
	ipfReadTime = time.Since(ipfStart)

	fileCount := reader.GetFileCount()
	if !config.Quiet {
		fmt.Printf("   Found %d files in archive\n", fileCount)
	}

	// Step 3: Read encrypted filenames
	printStep(config, "Reading encrypted filenames...")
	filenameReadStart := time.Now()
	if err := reader.ReadEncryptedFilenames(); err != nil {
		return fmt.Errorf("failed to read encrypted filenames: %w", err)
	}
	filenameReadTime = time.Since(filenameReadStart)

	// Get file infos
	fileInfos := reader.GetFileInfos()

	// Step 4: Parallel filename decryption
	printStep(config, "Decrypting filenames...")
	password := zipcipher.GetIPFPassword()
	decryptor := ipf.NewFilenameDecryptor(password, config.WorkerCount)

	decryptStartTime := time.Now()
	decryptionResults, err := decryptor.DecryptAllParallel(ctx, fileInfos)
	if err != nil {
		return fmt.Errorf("failed to decrypt filenames: %w", err)
	}
	decryptTime = time.Since(decryptStartTime)

	// Process decryption results
	resultProcessor := ipf.NewDecryptResultProcessor(len(decryptionResults))
	resultProcessor.ProcessResults(decryptionResults)

	successCount := resultProcessor.GetSuccessCount()
	successRate := resultProcessor.GetSuccessRate()

	// Update file infos with decrypted names
	ipf.UpdateFileInfos(fileInfos, decryptionResults)

	if !config.Quiet {
		fmt.Printf("   Decrypted %d/%d filenames (%.1f%%) in %.2fs\n",
			successCount, fileCount, successRate, decryptTime.Seconds())
		if successRate < 100.0 {
			fmt.Printf("   WARNING: %.1f%% filenames could not be decrypted\n", 100.0-successRate)
		}
	}

	// Step 5: Validate if requested
	if config.ValidateOnly {
		printStep(config, "Validation complete!")
		fmt.Printf("   IPF file is valid and contains %d files\n", fileCount)
		fmt.Printf("   Successfully decrypted %d filenames (%.1f%%)\n", successCount, successRate)

		// Print simple timing for validation mode
		if !config.Quiet {
			totalTime := time.Since(totalStartTime)
			fmt.Printf("   Total validation time: %.2fs\n", totalTime.Seconds())
		}
		return nil
	}

	// Step 6: Extract files
	printStep(config, "Extracting files...")
	var extractionResults []ipf.ExtractionResult

	// Get IPF password for extraction
	extractPasswordBytes := zipcipher.GetIPFPassword()

	extractStartTime := time.Now()

	// Use standard concurrent extractor
	extractor := ipf.NewConcurrentExtractor(reader, reader.ZipReader, config.WorkerCount)
	extractionResults, err = extractor.ExtractBatch(ctx, config.OutputDir, config.BatchSize, extractPasswordBytes)

	extractTime = time.Since(extractStartTime)

	// Calculate statistics
	stats := ipf.CalculateStats(extractionResults, extractTime.Milliseconds())

	// Print final results
	printStep(config, "Extraction complete!")

	if !config.Quiet {
		fmt.Printf("   Files extracted: %d/%d (%.1f%%)\n",
			stats.ExtractedFiles, stats.TotalFiles, stats.SuccessRate)
		fmt.Printf("   Total size: %.1f MB\n", float64(stats.TotalSize)/1024/1024)
		fmt.Printf("   Extraction time: %.2fs\n", extractTime.Seconds())
		fmt.Printf("   Average speed: %.1f MB/s\n", stats.AverageSpeedMBs)

		if len(stats.Errors) > 0 && config.Verbose {
			fmt.Printf("   Errors encountered: %d\n", len(stats.Errors))
			for i, err := range stats.Errors {
				if i >= 10 { // Limit error output
					fmt.Printf("   ... and %d more errors\n", len(stats.Errors)-10)
					break
				}
				fmt.Printf("   - %v\n", err)
			}
		}

		fmt.Printf("\nFiles saved to: %s\n", config.OutputDir)
		if stats.SuccessRate >= 95.0 {
			fmt.Printf("Extraction completed successfully (%.1f%% success rate)\n", stats.SuccessRate)
		} else if stats.SuccessRate >= 80.0 {
			fmt.Printf("Extraction completed with some issues (%.1f%% success rate)\n", stats.SuccessRate)
		} else {
			fmt.Printf("Extraction completed with many failures (%.1f%% success rate)\n", stats.SuccessRate)
		}

		// Print simple timing summary
		if !config.Quiet {
			totalTime := time.Since(totalStartTime)
			fmt.Printf("\nTiming Summary:\n")
			fmt.Printf("   IPF Structure Reading:        %.3fs\n", ipfReadTime.Seconds())
			fmt.Printf("   Filename Reading:             %.3fs\n", filenameReadTime.Seconds())
			fmt.Printf("   Filename Decryption:          %.3fs\n", decryptTime.Seconds())
			fmt.Printf("   File Extraction:              %.3fs\n", extractTime.Seconds())
			fmt.Printf("   Total Runtime:                 %.3fs\n", totalTime.Seconds())
		}
	}

	return nil
}

// printStep prints a step message if not in quiet mode
func printStep(config *Config, message string) {
	if !config.Quiet {
		fmt.Println(message)
	}
}
