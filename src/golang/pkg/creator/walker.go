package creator

import (
	"os"
	"path/filepath"
	"strings"
)

type FileInfo struct {
	Path         string
	RelativePath string
	ModTime      int64
}

type Walker struct {
	RootDir   string
	FileInfos []FileInfo
}

func NewWalker(rootDir string) *Walker {
	return &Walker{
		RootDir:   rootDir,
		FileInfos: make([]FileInfo, 0),
	}
}

func (w *Walker) Walk() error {
	return filepath.Walk(w.RootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		if w.FilterHiddenFiles(path) {
			relPath, err := filepath.Rel(w.RootDir, path)
			if err != nil {
				return err
			}

			relPath = filepath.ToSlash(relPath)

			w.FileInfos = append(w.FileInfos, FileInfo{
				Path:         path,
				RelativePath: relPath,
				ModTime:      info.ModTime().Unix(),
			})
		}

		return nil
	})
}

func (w *Walker) FilterHiddenFiles(path string) bool {
	basename := filepath.Base(path)
	return !strings.HasPrefix(basename, ".") && basename != "Thumbs.db"
}

func (w *Walker) GetFileCount() int {
	return len(w.FileInfos)
}
