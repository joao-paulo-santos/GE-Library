package zipwriter

import (
	"encoding/binary"
	"io"

	"github.com/joao-paulo-santos/GE-Library/pkg/ipf"
)

// WriteLocalFileHeaderFromIPF writes a local file header using ipf.FileInfo struct.
// Use this when writing from existing IPF data (e.g., optimizer).
func WriteLocalFileHeaderFromIPF(w io.Writer, file *ipf.FileInfo, genPurpose uint16) error {
	header := make([]byte, 30)

	binary.LittleEndian.PutUint32(header[0:4], 0x04034b50)
	binary.LittleEndian.PutUint16(header[4:6], file.VersionNeeded)
	binary.LittleEndian.PutUint16(header[6:8], genPurpose)
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

// WriteLocalFileHeaderFromParams writes a local file header using individual parameters.
// Use this when building new archives from scratch (e.g., creator).
func WriteLocalFileHeaderFromParams(w io.Writer, versionNeeded, genPurpose, method, modifiedTime, modifiedDate uint16, crc32 uint32, compressedSize, uncompressedSize uint64, encryptedNameLen, extraLen uint16, encryptedFilename, extraField []byte) error {
	header := make([]byte, 30)

	binary.LittleEndian.PutUint32(header[0:4], 0x04034b50)
	binary.LittleEndian.PutUint16(header[4:6], versionNeeded)
	binary.LittleEndian.PutUint16(header[6:8], genPurpose)
	binary.LittleEndian.PutUint16(header[8:10], method)
	binary.LittleEndian.PutUint16(header[10:12], modifiedTime)
	binary.LittleEndian.PutUint16(header[12:14], modifiedDate)
	binary.LittleEndian.PutUint32(header[14:18], crc32)
	binary.LittleEndian.PutUint32(header[18:22], uint32(compressedSize))
	binary.LittleEndian.PutUint32(header[22:26], uint32(uncompressedSize))
	binary.LittleEndian.PutUint16(header[26:28], encryptedNameLen)
	binary.LittleEndian.PutUint16(header[28:30], extraLen)

	if _, err := w.Write(header); err != nil {
		return err
	}

	if len(encryptedFilename) > 0 {
		if _, err := w.Write(encryptedFilename); err != nil {
			return err
		}
	}

	if len(extraField) > 0 {
		if _, err := w.Write(extraField); err != nil {
			return err
		}
	}

	return nil
}

// WriteCentralDirectoryEntryFromIPF writes a central directory entry using ipf.FileInfo struct.
// Use this when writing from existing IPF data (e.g., optimizer).
func WriteCentralDirectoryEntryFromIPF(w io.Writer, file *ipf.FileInfo, localHeaderOffset uint64, versionMadeBy uint16, genPurpose uint16) error {
	header := make([]byte, 46)

	binary.LittleEndian.PutUint32(header[0:4], 0x02014b50)
	binary.LittleEndian.PutUint16(header[4:6], versionMadeBy)

	binary.LittleEndian.PutUint16(header[6:8], file.VersionNeeded)
	binary.LittleEndian.PutUint16(header[8:10], genPurpose)
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

// WriteCentralDirectoryEntryFromParams writes a central directory entry using individual parameters.
// Use this when building new archives from scratch (e.g., creator).
func WriteCentralDirectoryEntryFromParams(w io.Writer, versionNeeded, versionMadeBy, genPurpose, method, modifiedTime, modifiedDate uint16, crc32 uint32, compressedSize, uncompressedSize uint64, encryptedNameLen, extraLen uint16, encryptedFilename, extraField []byte, localHeaderOffset uint64) error {
	header := make([]byte, 46)

	binary.LittleEndian.PutUint32(header[0:4], 0x02014b50)
	binary.LittleEndian.PutUint16(header[4:6], versionMadeBy)

	binary.LittleEndian.PutUint16(header[6:8], versionNeeded)
	binary.LittleEndian.PutUint16(header[8:10], genPurpose)
	binary.LittleEndian.PutUint16(header[10:12], method)
	binary.LittleEndian.PutUint16(header[12:14], modifiedTime)
	binary.LittleEndian.PutUint16(header[14:16], modifiedDate)
	binary.LittleEndian.PutUint32(header[16:20], crc32)
	binary.LittleEndian.PutUint32(header[20:24], uint32(compressedSize))
	binary.LittleEndian.PutUint32(header[24:28], uint32(uncompressedSize))
	binary.LittleEndian.PutUint16(header[28:30], encryptedNameLen)
	binary.LittleEndian.PutUint16(header[30:32], extraLen)
	binary.LittleEndian.PutUint16(header[32:34], 0)
	binary.LittleEndian.PutUint16(header[34:36], 0)
	binary.LittleEndian.PutUint16(header[36:38], 0)
	binary.LittleEndian.PutUint32(header[38:42], 0)
	binary.LittleEndian.PutUint32(header[42:46], uint32(localHeaderOffset))

	if _, err := w.Write(header); err != nil {
		return err
	}

	if len(encryptedFilename) > 0 {
		if _, err := w.Write(encryptedFilename); err != nil {
			return err
		}
	}

	if len(extraField) > 0 {
		if _, err := w.Write(extraField); err != nil {
			return err
		}
	}

	return nil
}

func WriteEndOfCentralDirectory(w io.Writer, cdOffset, cdSize uint64, fileCount uint16) error {
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
