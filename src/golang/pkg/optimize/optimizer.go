package optimize

import (
	"context"
	"fmt"
	"io"
	"os"
	"sort"

	"github.com/joao-paulo-santos/GE-Library/pkg/ipf"
	"github.com/joao-paulo-santos/GE-Library/pkg/zipcipher"
	"github.com/joao-paulo-santos/GE-Library/pkg/zipwriter"
)

func OptimizeIPF(filePath string, createBackup bool) error {
	fmt.Printf("Optimizing: %s\n", filePath)

	var backupPath string

	if createBackup {
		backupPath = filePath + ".bak"
		if err := os.Rename(filePath, backupPath); err != nil {
			return fmt.Errorf("failed to create backup: %w", err)
		}
		filePath = backupPath
	}

	tempPath := filePath + ".tmp"

	reader, err := ipf.NewIPFReader(filePath)
	if err != nil {
		if createBackup {
			os.Rename(backupPath, filePath)
		}
		return fmt.Errorf("failed to open IPF reader: %w", err)
	}

	if err := reader.ReadFileStructure(); err != nil {
		reader.Close()
		if createBackup {
			os.Rename(backupPath, filePath)
		}
		return fmt.Errorf("failed to read file structure: %w", err)
	}

	if err := reader.ReadEncryptedFilenames(); err != nil {
		reader.Close()
		if createBackup {
			os.Rename(backupPath, filePath)
		}
		return fmt.Errorf("failed to read encrypted filenames: %w", err)
	}

	fileInfos := reader.GetFileInfos()

	password := zipcipher.GetIPFPassword()
	decryptor := ipf.NewFilenameDecryptor(password, 4)

	ctx := context.Background()
	decryptionResults, err := decryptor.DecryptAllParallel(ctx, fileInfos)
	if err != nil {
		reader.Close()
		if createBackup {
			os.Rename(backupPath, filePath)
		}
		return fmt.Errorf("failed to decrypt filenames: %w", err)
	}

	ipf.UpdateFileInfos(fileInfos, decryptionResults)

	deduplicator := ipf.NewDeduplicator(fileInfos)
	retained := deduplicator.Run()

	// Sort retained files by their original Index to preserve order
	sort.Slice(retained, func(i, j int) bool {
		return retained[i].Index < retained[j].Index
	})

	stats := deduplicator.GetStats()
	fmt.Printf("Deduplication: %s\n", stats.String())

	reader.Close()

	if err := createOptimizedIPF(filePath, tempPath, retained); err != nil {
		if createBackup {
			os.Rename(backupPath, filePath)
			os.Remove(tempPath)
		}
		return fmt.Errorf("failed to create optimized IPF: %w", err)
	}

	finalPath := filePath
	if createBackup {
		finalPath = filePath[:len(filePath)-4]
	}

	if err := os.Rename(tempPath, finalPath); err != nil {
		if createBackup {
			os.Rename(backupPath, filePath)
			os.Remove(tempPath)
		}
		return fmt.Errorf("failed to rename temp file: %w", err)
	}

	if createBackup {
		os.Remove(backupPath)
	}

	return nil
}

func createOptimizedIPF(originalIPFPath, outputPath string, retained []ipf.FileInfo) error {
	originalFile, err := os.Open(originalIPFPath)
	if err != nil {
		return fmt.Errorf("failed to open original file: %w", err)
	}
	defer originalFile.Close()

	outputFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create output file: %w", err)
	}
	defer outputFile.Close()

	var currentOffset uint64 = 0
	localHeaderOffsets := make([]uint64, len(retained))

	for i := range retained {
		file := &retained[i]
		localHeaderOffsets[i] = currentOffset

		if err := zipwriter.WriteLocalFileHeader(outputFile, file, 0x0009); err != nil {
			return fmt.Errorf("failed to write local header for file %d: %w", i, err)
		}

		dataOffset := int64(file.LocalHeaderOffset) + int64(file.HeaderSize)
		if _, err := originalFile.Seek(dataOffset, io.SeekStart); err != nil {
			return fmt.Errorf("failed to seek to data offset for file %d: %w", i, err)
		}

		if err := copyCompressedData(outputFile, originalFile, file.ZipInfo.CompressedSize64); err != nil {
			return fmt.Errorf("failed to copy compressed data for file %d: %w", i, err)
		}

		currentOffset += uint64(file.HeaderSize) + file.ZipInfo.CompressedSize64
	}

	cdOffset := currentOffset

	for i := range retained {
		file := &retained[i]
		localHeaderOffset := localHeaderOffsets[i]

		if err := zipwriter.WriteCentralDirectoryEntry(outputFile, file, localHeaderOffset, 0x0014, 0x0009); err != nil {
			return fmt.Errorf("failed to write central directory entry for file %d: %w", i, err)
		}

		currentOffset += 46 + uint64(file.EncryptedNameLen) + uint64(file.ExtraLen)
	}

	cdSize := currentOffset - cdOffset

	if err := zipwriter.WriteEndOfCentralDirectory(outputFile, cdOffset, cdSize, uint16(len(retained))); err != nil {
		return fmt.Errorf("failed to write end of central directory: %w", err)
	}

	return outputFile.Close()
}

func copyCompressedData(dst io.Writer, src io.Reader, size uint64) error {
	_, err := io.CopyN(dst, src, int64(size))
	return err
}
