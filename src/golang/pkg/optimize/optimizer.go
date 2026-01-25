package optimize

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"sort"

	"github.com/joao-paulo-santos/GE-Library/pkg/ipf"
	"github.com/joao-paulo-santos/GE-Library/pkg/zipcipher"
)

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

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

		if err := writeLocalFileHeader(outputFile, file, currentOffset); err != nil {
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

		if err := writeCentralDirectoryEntry(outputFile, file, localHeaderOffset); err != nil {
			return fmt.Errorf("failed to write central directory entry for file %d: %w", i, err)
		}

		currentOffset += 46 + uint64(file.EncryptedNameLen) + uint64(file.ExtraLen)
	}

	cdSize := currentOffset - cdOffset

	if err := writeEndOfCentralDirectory(outputFile, cdOffset, cdSize, uint16(len(retained))); err != nil {
		return fmt.Errorf("failed to write end of central directory: %w", err)
	}

	return outputFile.Close()
}

func writeLocalFileHeader(w io.Writer, file *ipf.FileInfo, offset uint64) error {
	header := make([]byte, 30)

	binary.LittleEndian.PutUint32(header[0:4], 0x04034b50)
	binary.LittleEndian.PutUint16(header[4:6], file.VersionNeeded)
	binary.LittleEndian.PutUint16(header[6:8], 0x0009)
	binary.LittleEndian.PutUint16(header[8:10], file.ZipInfo.Method)
	binary.LittleEndian.PutUint16(header[10:12], file.ZipInfo.ModifiedTime)
	binary.LittleEndian.PutUint16(header[12:14], file.ZipInfo.ModifiedDate)
	binary.LittleEndian.PutUint32(header[14:18], file.ZipInfo.CRC32)
	binary.LittleEndian.PutUint32(header[18:22], uint32(file.ZipInfo.CompressedSize64))
	binary.LittleEndian.PutUint32(header[22:26], uint32(file.ZipInfo.UncompressedSize64))
	binary.LittleEndian.PutUint16(header[26:28], file.EncryptedNameLen)
	binary.LittleEndian.PutUint16(header[28:30], file.ExtraLen)

	if _, err := w.Write(header); err != nil {
		return err
	}

	if len(file.EncryptedFilename) > 0 {
		if _, err := w.Write(file.EncryptedFilename); err != nil {
			return err
		}
	}

	if len(file.ExtraField) > 0 {
		if _, err := w.Write(file.ExtraField); err != nil {
			return err
		}
	}

	return nil
}

func copyCompressedData(dst io.Writer, src io.Reader, size uint64) error {
	_, err := io.CopyN(dst, src, int64(size))
	return err
}

func writeCentralDirectoryEntry(w io.Writer, file *ipf.FileInfo, localHeaderOffset uint64) error {
	header := make([]byte, 46)

	binary.LittleEndian.PutUint32(header[0:4], 0x02014b50)
	binary.LittleEndian.PutUint16(header[4:6], 0x0014) // ZIP 2.0 (original IPFs usually have 0x0000)

	binary.LittleEndian.PutUint16(header[6:8], file.VersionNeeded)
	binary.LittleEndian.PutUint16(header[8:10], 0x0009)
	binary.LittleEndian.PutUint16(header[10:12], file.ZipInfo.Method)
	binary.LittleEndian.PutUint16(header[12:14], file.ZipInfo.ModifiedTime)
	binary.LittleEndian.PutUint16(header[14:16], file.ZipInfo.ModifiedDate)
	binary.LittleEndian.PutUint32(header[16:20], file.ZipInfo.CRC32)
	binary.LittleEndian.PutUint32(header[20:24], uint32(file.ZipInfo.CompressedSize64))
	binary.LittleEndian.PutUint32(header[24:28], uint32(file.ZipInfo.UncompressedSize64))
	binary.LittleEndian.PutUint16(header[28:30], file.EncryptedNameLen)
	binary.LittleEndian.PutUint16(header[30:32], file.ExtraLen)
	binary.LittleEndian.PutUint16(header[32:34], 0)
	binary.LittleEndian.PutUint16(header[34:36], 0)
	binary.LittleEndian.PutUint16(header[36:38], 0)
	binary.LittleEndian.PutUint32(header[38:42], 0)
	binary.LittleEndian.PutUint32(header[42:46], uint32(localHeaderOffset))

	if _, err := w.Write(header); err != nil {
		return err
	}

	if len(file.EncryptedFilename) > 0 {
		if _, err := w.Write(file.EncryptedFilename); err != nil {
			return err
		}
	}

	if len(file.ExtraField) > 0 {
		if _, err := w.Write(file.ExtraField); err != nil {
			return err
		}
	}

	return nil
}

func writeEndOfCentralDirectory(w io.Writer, cdOffset, cdSize uint64, fileCount uint16) error {
	record := make([]byte, 22)

	binary.LittleEndian.PutUint32(record[0:4], 0x06054b50)
	binary.LittleEndian.PutUint16(record[4:6], 0)
	binary.LittleEndian.PutUint16(record[6:8], 0)
	binary.LittleEndian.PutUint16(record[8:10], fileCount)
	binary.LittleEndian.PutUint16(record[10:12], fileCount)
	binary.LittleEndian.PutUint32(record[12:16], uint32(cdSize))
	binary.LittleEndian.PutUint32(record[16:20], uint32(cdOffset))
	binary.LittleEndian.PutUint16(record[20:22], 0)

	_, err := w.Write(record)
	return err
}
