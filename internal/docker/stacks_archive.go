package docker

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

var ErrStackExists = errors.New("stack already exists")

const (
	maxArchiveFiles = 10_000
	maxArchiveBytes = 256 << 20
)

func (s *Stacks) ExportStack(name string, includeEnv bool, w io.Writer) error {
	dir := s.stackDir(name)
	if _, err := os.Stat(dir); err != nil {
		return err
	}

	zw := zip.NewWriter(w)
	err := filepath.WalkDir(dir, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(dir, p)
		if err != nil {
			return err
		}
		if rel == "." || d.IsDir() {
			return nil
		}
		if !d.Type().IsRegular() {
			return nil
		}
		if !includeEnv && rel == ".env" {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		f, err := os.Open(p)
		if err != nil {
			return err
		}
		hdr, err := zip.FileInfoHeader(info)
		if err != nil {
			_ = f.Close()
			return err
		}
		hdr.Name = filepath.ToSlash(rel)
		hdr.Method = zip.Deflate
		dst, err := zw.CreateHeader(hdr)
		if err != nil {
			_ = f.Close()
			return err
		}
		_, copyErr := io.Copy(dst, f)
		closeErr := f.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	})
	if err != nil {
		_ = zw.Close()
		return err
	}
	return zw.Close()
}

func (s *Stacks) ImportStack(name string, archive io.ReaderAt, size int64) error {
	zr, err := zip.NewReader(archive, size)
	if err != nil {
		return fmt.Errorf("invalid zip archive: %w", err)
	}

	var files int
	var declared uint64
	for _, f := range zr.File {
		rel, err := safeArchivePath(f.Name)
		if err != nil {
			return err
		}
		if rel == "" || f.FileInfo().IsDir() {
			continue
		}
		if f.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("%q: symlinks are not allowed", f.Name)
		}
		files++
		declared += f.UncompressedSize64
		if declared > maxArchiveBytes {
			return fmt.Errorf("archive exceeds %d MB", maxArchiveBytes>>20)
		}
	}
	if files == 0 {
		return errors.New("archive is empty")
	}
	if len(zr.File) > maxArchiveFiles {
		return fmt.Errorf("archive has too many entries (max %d)", maxArchiveFiles)
	}

	tmp, err := os.MkdirTemp(s.stacksDir, ".import-")
	if err != nil {
		return err
	}
	defer func() { _ = os.RemoveAll(tmp) }()

	var written uint64
	for _, f := range zr.File {
		rel, err := safeArchivePath(f.Name)
		if err != nil {
			return err
		}
		if rel == "" || f.FileInfo().IsDir() {
			continue
		}
		target := filepath.Join(tmp, filepath.FromSlash(rel))
		if !isWithinDir(tmp, target) {
			return fmt.Errorf("%q: unsafe path", f.Name)
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		mode := f.Mode().Perm()
		if mode == 0 {
			mode = 0o644
		}
		out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
		if err != nil {
			_ = rc.Close()
			return err
		}
		n, copyErr := io.Copy(out, io.LimitReader(rc, int64(maxArchiveBytes+1-written)))
		closeErr := out.Close()
		_ = rc.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		written += uint64(n)
		if written > maxArchiveBytes {
			return fmt.Errorf("archive exceeds %d MB when extracted", maxArchiveBytes>>20)
		}
	}

	dest := s.stackDir(name)
	if _, err := os.Stat(dest); err == nil {
		return ErrStackExists
	} else if !os.IsNotExist(err) {
		return err
	}
	if err := os.Rename(tmp, dest); err != nil {
		if _, statErr := os.Stat(dest); statErr == nil {
			return ErrStackExists
		}
		return err
	}
	return nil
}

func safeArchivePath(name string) (string, error) {
	if name == "" || strings.ContainsAny(name, "\\\x00") {
		return "", fmt.Errorf("%q: unsafe path", name)
	}
	clean := path.Clean(name)
	if clean == "." {
		return "", nil
	}
	if path.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", fmt.Errorf("%q: unsafe path", name)
	}
	return clean, nil
}

func isWithinDir(base, target string) bool {
	rel, err := filepath.Rel(base, target)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}
