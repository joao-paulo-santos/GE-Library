package creator

import (
	"bytes"
	"compress/flate"
	"fmt"
	"hash/crc32"
	"io"
	"os"
	"sort"
	"time"

	"github.com/joao-paulo-santos/GE-Library/pkg/zipcipher"
	"github.com/joao-paulo-santos/GE-Library/pkg/zipwriter"
)

type Creator struct {
	RootDir          string
	OutputFile       string
	Password         []byte
	GenPurpose       uint16
	VersionMadeBy    uint16
	CompressionLevel int
}

func NewCreator(rootDir, outputFile string, encrypt bool) *Creator {
	password := zipcipher.GetIPFPassword()
	genPurpose := uint16(0x0001)
	if !encrypt {
		genPurpose = 0x0000
	}

	return &Creator{
		RootDir:          rootDir,
		OutputFile:       outputFile,
		Password:         password,
		GenPurpose:       genPurpose,
		VersionMadeBy:    0x0000,
		CompressionLevel: 6,
	}
}

func (c *Creator) CreateIPF() error {
	walker := NewWalker(c.RootDir)
	err := walker.Walk()
	if err != nil {
		return fmt.Errorf("failed to walk directory: %w", err)
	}

	fileCount := walker.GetFileCount()
	if fileCount == 0 {
		return fmt.Errorf("no files found in directory")
	}

	sort.Slice(walker.FileInfos, func(i, j int) bool {
		return walker.FileInfos[i].RelativePath < walker.FileInfos[j].RelativePath
	})

	if c.GenPurpose == 0x0000 {
		return c.createPlainZIP(walker.FileInfos)
	}
	return c.createEncryptedZIP(walker.FileInfos)
}

func (c *Creator) createPlainZIP(fileInfos []FileInfo) error {
	outputFile, err := os.Create(c.OutputFile)
	if err != nil {
		return fmt.Errorf("failed to create output file: %w", err)
	}
	defer outputFile.Close()

	versionNeeded := uint16(0x0014)
	genPurpose := uint16(0x0000)
	method := uint16(0x0008)
	extraLen := uint16(0x0000)
	var extraField []byte

	var localHeaderOffsets []uint64
	var centralDirEntries []centralDirEntry

	for _, fileInfo := range fileInfos {
		data, err := os.ReadFile(fileInfo.Path)
		if err != nil {
			return fmt.Errorf("failed to read file %s: %w", fileInfo.Path, err)
		}

		crc32Val := crc32.ChecksumIEEE(data)

		uncompressedSize := uint64(len(data))
		var compressedData []byte
		var compressedSize uint64

		if c.CompressionLevel > 0 {
			var buf bytes.Buffer
			writer, err := flate.NewWriter(&buf, c.CompressionLevel)
			if err != nil {
				return fmt.Errorf("failed to create compressor: %w", err)
			}

			_, err = writer.Write(data)
			if err != nil {
				writer.Close()
				return fmt.Errorf("failed to compress data: %w", err)
			}
			err = writer.Close()
			if err != nil {
				return fmt.Errorf("failed to close compressor: %w", err)
			}

			compressedData = buf.Bytes()
			compressedSize = uint64(len(compressedData))
		} else {
			compressedData = data
			compressedSize = uncompressedSize
		}

		filename := []byte(fileInfo.RelativePath)
		filenameLen := uint16(len(filename))

		modTime, modDate := timestampToMSDOS(time.Unix(fileInfo.ModTime, 0))

		offset, err := outputFile.Seek(0, io.SeekCurrent)
		if err != nil {
			return fmt.Errorf("failed to get offset: %w", err)
		}

		err = zipwriter.WriteLocalFileHeaderFromParams(
			outputFile,
			versionNeeded,
			genPurpose,
			method,
			modTime,
			modDate,
			crc32Val,
			compressedSize,
			uncompressedSize,
			filenameLen,
			extraLen,
			filename,
			extraField,
		)
		if err != nil {
			return fmt.Errorf("failed to write local file header: %w", err)
		}

		if _, err := outputFile.Write(compressedData); err != nil {
			return fmt.Errorf("failed to write compressed data: %w", err)
		}

		localHeaderOffsets = append(localHeaderOffsets, uint64(offset))
		centralDirEntries = append(centralDirEntries, centralDirEntry{
			modTime:          modTime,
			modDate:          modDate,
			crc32:            crc32Val,
			compressedSize:   compressedSize,
			uncompressedSize: uncompressedSize,
			filenameLen:      filenameLen,
			filename:         filename,
		})
	}

	cdOffset, err := outputFile.Seek(0, io.SeekCurrent)
	if err != nil {
		return fmt.Errorf("failed to get central directory offset: %w", err)
	}

	for i, entry := range centralDirEntries {
		err = zipwriter.WriteCentralDirectoryEntryFromParams(
			outputFile,
			versionNeeded,
			c.VersionMadeBy,
			genPurpose,
			method,
			entry.modTime,
			entry.modDate,
			entry.crc32,
			entry.compressedSize,
			entry.uncompressedSize,
			entry.filenameLen,
			extraLen,
			entry.filename,
			extraField,
			localHeaderOffsets[i],
		)
		if err != nil {
			return fmt.Errorf("failed to write central directory entry: %w", err)
		}
	}

	cdEndOffset, err := outputFile.Seek(0, io.SeekCurrent)
	if err != nil {
		return fmt.Errorf("failed to get central directory end offset: %w", err)
	}

	cdSize := uint64(cdEndOffset - cdOffset)

	err = zipwriter.WriteEndOfCentralDirectory(
		outputFile,
		uint64(cdOffset),
		cdSize,
		uint16(len(centralDirEntries)),
	)
	if err != nil {
		return fmt.Errorf("failed to write end of central directory: %w", err)
	}

	return nil
}

func (c *Creator) createEncryptedZIP(fileInfos []FileInfo) error {
	outputFile, err := os.Create(c.OutputFile)
	if err != nil {
		return fmt.Errorf("failed to create output file: %w", err)
	}
	defer outputFile.Close()

	versionNeeded := uint16(0x0014)
	genPurpose := c.GenPurpose
	method := uint16(0x0008)
	extraLen := uint16(0x0000)
	var extraField []byte

	var localHeaderOffsets []uint64
	var centralDirEntries []centralDirEntry

	for _, fileInfo := range fileInfos {
		data, err := os.ReadFile(fileInfo.Path)
		if err != nil {
			return fmt.Errorf("failed to read file %s: %w", fileInfo.Path, err)
		}

		crc32Val := crc32.ChecksumIEEE(data)

		uncompressedSize := uint64(len(data))
		var compressedData []byte

		if c.CompressionLevel > 0 {
			var buf bytes.Buffer
			writer, err := flate.NewWriter(&buf, c.CompressionLevel)
			if err != nil {
				return fmt.Errorf("failed to create compressor: %w", err)
			}

			_, err = writer.Write(data)
			if err != nil {
				writer.Close()
				return fmt.Errorf("failed to compress data: %w", err)
			}
			err = writer.Close()
			if err != nil {
				return fmt.Errorf("failed to close compressor: %w", err)
			}

			compressedData = buf.Bytes()
		} else {
			compressedData = data
		}

		modTime, modDate := timestampToMSDOS(time.Unix(fileInfo.ModTime, 0))

		plaintextFilename := fileInfo.RelativePath
		encryptedFilename := EncryptFilename(plaintextFilename, c.Password)
		encryptedFilenameLen := uint16(len(encryptedFilename))

		modTimeHighByte := byte(modTime >> 8)
		encryptedData, err := EncryptData(compressedData, c.Password, modTimeHighByte)
		if err != nil {
			return fmt.Errorf("failed to encrypt data: %w", err)
		}
		encryptedSize := uint64(len(encryptedData))

		offset, err := outputFile.Seek(0, io.SeekCurrent)
		if err != nil {
			return fmt.Errorf("failed to get offset: %w", err)
		}

		err = zipwriter.WriteLocalFileHeaderFromParams(
			outputFile,
			versionNeeded,
			genPurpose,
			method,
			modTime,
			modDate,
			crc32Val,
			encryptedSize,
			uncompressedSize,
			encryptedFilenameLen,
			extraLen,
			encryptedFilename,
			extraField,
		)
		if err != nil {
			return fmt.Errorf("failed to write local file header: %w", err)
		}

		if _, err := outputFile.Write(encryptedData); err != nil {
			return fmt.Errorf("failed to write encrypted data: %w", err)
		}

		localHeaderOffsets = append(localHeaderOffsets, uint64(offset))
		centralDirEntries = append(centralDirEntries, centralDirEntry{
			modTime:          modTime,
			modDate:          modDate,
			crc32:            crc32Val,
			compressedSize:   encryptedSize,
			uncompressedSize: uncompressedSize,
			filenameLen:      encryptedFilenameLen,
			filename:         encryptedFilename,
		})
	}

	cdOffset, err := outputFile.Seek(0, io.SeekCurrent)
	if err != nil {
		return fmt.Errorf("failed to get central directory offset: %w", err)
	}

	for i, entry := range centralDirEntries {
		err = zipwriter.WriteCentralDirectoryEntryFromParams(
			outputFile,
			versionNeeded,
			c.VersionMadeBy,
			genPurpose,
			method,
			entry.modTime,
			entry.modDate,
			entry.crc32,
			entry.compressedSize,
			entry.uncompressedSize,
			entry.filenameLen,
			extraLen,
			entry.filename,
			extraField,
			localHeaderOffsets[i],
		)
		if err != nil {
			return fmt.Errorf("failed to write central directory entry: %w", err)
		}
	}

	cdEndOffset, err := outputFile.Seek(0, io.SeekCurrent)
	if err != nil {
		return fmt.Errorf("failed to get central directory end offset: %w", err)
	}

	cdSize := uint64(cdEndOffset - cdOffset)

	err = zipwriter.WriteEndOfCentralDirectory(
		outputFile,
		uint64(cdOffset),
		cdSize,
		uint16(len(centralDirEntries)),
	)
	if err != nil {
		return fmt.Errorf("failed to write end of central directory: %w", err)
	}

	return nil
}

type centralDirEntry struct {
	modTime          uint16
	modDate          uint16
	crc32            uint32
	compressedSize   uint64
	uncompressedSize uint64
	filenameLen      uint16
	filename         []byte
}

func timestampToMSDOS(t time.Time) (uint16, uint16) {
	date := uint16(t.Day()) | uint16(t.Month())<<5 | uint16(t.Year()-1980)<<9
	hour := uint16(t.Hour())
	minute := uint16(t.Minute())
	second := uint16(t.Second() / 2)
	timeVal := second | minute<<5 | hour<<11
	return uint16(timeVal), date
}
