package ipf

import (
	"fmt"
)

// Deduplicator handles IPF progressive bloat by keeping only newest version of each file
type Deduplicator struct {
	fileInfos []FileInfo
}

// NewDeduplicator creates a new deduplicator from file infos
func NewDeduplicator(fileInfos []FileInfo) *Deduplicator {
	return &Deduplicator{
		fileInfos: fileInfos,
	}
}

// Run performs deduplication and returns only newest versions
// Returns a slice of FileInfo containing only the latest version of each file
func (d *Deduplicator) Run() []FileInfo {
	filenameMap := make(map[string]*FileInfo)

	for i, fileInfo := range d.fileInfos {
		existing, exists := filenameMap[fileInfo.SafeFilename]
		if exists {
			if i > existing.Index {
				filenameMap[fileInfo.SafeFilename] = &fileInfo
			}
		} else {
			filenameMap[fileInfo.SafeFilename] = &fileInfo
		}
	}

	deduplicated := make([]FileInfo, 0, len(filenameMap))
	for _, fileInfo := range filenameMap {
		deduplicated = append(deduplicated, *fileInfo)
	}

	return deduplicated
}

// GetStats returns statistics about deduplication
func (d *Deduplicator) GetStats() DeduplicationStats {
	stats := DeduplicationStats{
		TotalFiles:        len(d.fileInfos),
		UniqueFiles:       0,
		RemovedDuplicates: 0,
	}

	deduplicated := d.Run()
	stats.UniqueFiles = len(deduplicated)
	stats.RemovedDuplicates = len(d.fileInfos) - len(deduplicated)

	return stats
}

// DeduplicationStats contains statistics about the deduplication process
type DeduplicationStats struct {
	TotalFiles        int
	UniqueFiles       int
	RemovedDuplicates int
}

func (s DeduplicationStats) String() string {
	percentRemoved := float64(0)
	if s.TotalFiles > 0 {
		percentRemoved = float64(s.RemovedDuplicates) / float64(s.TotalFiles) * 100.0
	}

	return fmt.Sprintf("Total: %d, Unique: %d, Removed: %d (%.1f%%)",
		s.TotalFiles, s.UniqueFiles, s.RemovedDuplicates, percentRemoved)
}
