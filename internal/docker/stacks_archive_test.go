package docker

import (
	"archive/zip"
	"bytes"
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func newArchiveStacks(t *testing.T) *Stacks {
	t.Helper()
	return &Stacks{stacksDir: t.TempDir()}
}

func makeZip(t *testing.T, files map[string]string) *bytes.Reader {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := io.WriteString(w, content); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return bytes.NewReader(buf.Bytes())
}

func TestExportStack(t *testing.T) {
	s := newArchiveStacks(t)
	dir := filepath.Join(s.stacksDir, "app")
	if err := os.MkdirAll(filepath.Join(dir, "conf"), 0o755); err != nil {
		t.Fatal(err)
	}
	for name, content := range map[string]string{
		"compose.yaml":  "services: {}",
		".env":          "SECRET=1",
		"conf/app.conf": "x=1",
	} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	read := func(includeEnv bool) map[string]string {
		var buf bytes.Buffer
		if err := s.ExportStack("app", includeEnv, &buf); err != nil {
			t.Fatal(err)
		}
		zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
		if err != nil {
			t.Fatal(err)
		}
		files := map[string]string{}
		for _, f := range zr.File {
			rc, err := f.Open()
			if err != nil {
				t.Fatal(err)
			}
			b, err := io.ReadAll(rc)
			_ = rc.Close()
			if err != nil {
				t.Fatal(err)
			}
			files[f.Name] = string(b)
		}
		return files
	}

	withEnv := read(true)
	if len(withEnv) != 3 || withEnv[".env"] != "SECRET=1" || withEnv["conf/app.conf"] != "x=1" {
		t.Fatalf("unexpected export: %#v", withEnv)
	}
	withoutEnv := read(false)
	if _, ok := withoutEnv[".env"]; ok {
		t.Fatalf(".env should be excluded: %#v", withoutEnv)
	}
	if withoutEnv["compose.yaml"] != "services: {}" {
		t.Fatalf("compose missing: %#v", withoutEnv)
	}
}

func TestImportStack(t *testing.T) {
	s := newArchiveStacks(t)
	archive := makeZip(t, map[string]string{
		"compose.yaml":  "services: {}",
		".env":          "SECRET=1",
		"conf/app.conf": "x=1",
	})
	if err := s.ImportStack("imported", archive, archive.Size()); err != nil {
		t.Fatal(err)
	}
	for name, want := range map[string]string{
		"compose.yaml":  "services: {}",
		".env":          "SECRET=1",
		"conf/app.conf": "x=1",
	} {
		got, err := os.ReadFile(filepath.Join(s.stacksDir, "imported", name))
		if err != nil {
			t.Fatal(err)
		}
		if string(got) != want {
			t.Errorf("%s: got %q, want %q", name, got, want)
		}
	}
}

func TestImportStackRejectsCollision(t *testing.T) {
	s := newArchiveStacks(t)
	if err := os.MkdirAll(filepath.Join(s.stacksDir, "existing"), 0o755); err != nil {
		t.Fatal(err)
	}
	archive := makeZip(t, map[string]string{"compose.yaml": "services: {}"})
	if err := s.ImportStack("existing", archive, archive.Size()); !errors.Is(err, ErrStackExists) {
		t.Fatalf("got %v, want ErrStackExists", err)
	}
}

func TestImportStackRejectsUnsafePaths(t *testing.T) {
	cases := map[string]string{
		"parent traversal": "../evil.txt",
		"nested traversal": "conf/../../evil.txt",
		"absolute path":    "/tmp/evil.txt",
		"backslash":        `..\evil.txt`,
	}
	for name, entry := range cases {
		t.Run(name, func(t *testing.T) {
			s := newArchiveStacks(t)
			archive := makeZip(t, map[string]string{"compose.yaml": "services: {}", entry: "pwned"})
			if err := s.ImportStack("app", archive, archive.Size()); err == nil {
				t.Fatal("expected error, got nil")
			}
			if _, err := os.Stat(filepath.Join(s.stacksDir, "app")); !os.IsNotExist(err) {
				t.Fatalf("stack directory should not exist: %v", err)
			}
			if _, err := os.Stat(filepath.Join(filepath.Dir(s.stacksDir), "evil.txt")); !os.IsNotExist(err) {
				t.Fatalf("file escaped the stacks dir: %v", err)
			}
		})
	}
}

func TestImportStackRejectsSymlinks(t *testing.T) {
	s := newArchiveStacks(t)
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	hdr := &zip.FileHeader{Name: "link", Method: zip.Store}
	hdr.SetMode(os.ModeSymlink | 0o777)
	w, err := zw.CreateHeader(hdr)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.WriteString(w, "/etc/passwd"); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	r := bytes.NewReader(buf.Bytes())
	if err := s.ImportStack("app", r, r.Size()); err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestImportStackRejectsEmptyArchive(t *testing.T) {
	s := newArchiveStacks(t)
	r := makeZip(t, map[string]string{})
	if err := s.ImportStack("app", r, r.Size()); err == nil {
		t.Fatal("expected error, got nil")
	}
}
