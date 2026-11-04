package docker

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"
)

func TestStaleFromDigest(t *testing.T) {
	cases := []struct {
		name        string
		repoDigests []string
		digest      string
		ok          bool
		want        StaleStatus
	}{
		{"match", []string{"nginx@sha256:abc"}, "sha256:abc", true, StaleUpToDate},
		{"mismatch", []string{"nginx@sha256:abc"}, "sha256:def", true, StaleOutdated},
		{"lookup failed", []string{"nginx@sha256:abc"}, "", false, StaleUnknown},
		{"empty digest", []string{"nginx@sha256:abc"}, "", true, StaleUnknown},
		{"no repo digests", nil, "sha256:abc", true, StaleUnknown},
	}
	for _, c := range cases {
		if got := staleFromDigest(c.repoDigests, c.digest, c.ok); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}

func TestAggregateStale(t *testing.T) {
	cases := []struct {
		name     string
		statuses []StaleStatus
		want     StaleStatus
	}{
		{"all up to date", []StaleStatus{StaleUpToDate, StaleUpToDate}, StaleUpToDate},
		{"one outdated", []StaleStatus{StaleUpToDate, StaleOutdated}, StaleOutdated},
		{"outdated wins over unknown", []StaleStatus{StaleUnknown, StaleOutdated}, StaleOutdated},
		{"unknown without outdated", []StaleStatus{StaleUpToDate, StaleUnknown}, StaleUnknown},
		{"empty", nil, StaleUpToDate},
	}
	for _, c := range cases {
		if got := aggregateStale(c.statuses); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}

func TestContainerStaleUsesCachedDigest(t *testing.T) {
	c, err := NewClient("unix:///nonexistent.sock", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	s := NewStacks(c, t.TempDir(), "", "localhost", "")

	images := map[string]ImageInfo{
		"abcd12345678": {ID: "abcd12345678", RepoDigests: []string{"nginx@sha256:remote"}},
	}
	summary := container.Summary{
		Image:   "nginx:latest",
		ImageID: "sha256:abcd1234567890abcdef",
	}

	c.digests = map[string]remoteDigestEntry{
		"nginx:latest": {digest: "sha256:remote", at: time.Now()},
	}
	if got := s.containerStale(context.Background(), summary, images, "nginx:latest"); got != StaleUpToDate {
		t.Errorf("matching digest: got %q, want %q", got, StaleUpToDate)
	}

	c.digests["nginx:latest"] = remoteDigestEntry{digest: "sha256:other", at: time.Now()}
	if got := s.containerStale(context.Background(), summary, images, "nginx:latest"); got != StaleOutdated {
		t.Errorf("moved digest: got %q, want %q", got, StaleOutdated)
	}

	summary.ImageID = "sha256:ffffffffffffffff"
	if got := s.containerStale(context.Background(), summary, images, "nginx:latest"); got != StaleUnknown {
		t.Errorf("unknown image id: got %q, want %q", got, StaleUnknown)
	}
}

func TestComposeServiceImages(t *testing.T) {
	dir := t.TempDir()
	stackDir := filepath.Join(dir, "demo")
	if err := os.MkdirAll(stackDir, 0o755); err != nil {
		t.Fatal(err)
	}
	compose := "services:\n  app:\n    image: nginx:latest\n  build-only:\n    build: .\n"
	if err := os.WriteFile(filepath.Join(stackDir, "compose.yaml"), []byte(compose), 0o644); err != nil {
		t.Fatal(err)
	}
	c, err := NewClient("unix:///nonexistent.sock", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	s := NewStacks(c, dir, "", "localhost", "")
	got := s.composeServiceImages("demo")
	if got["app"] != "nginx:latest" {
		t.Errorf("app image: got %q, want nginx:latest", got["app"])
	}
	if _, ok := got["build-only"]; ok {
		t.Error("build-only service should have no image")
	}
}

func TestContainerImageTag(t *testing.T) {
	cases := []struct {
		name       string
		summary    container.Summary
		composeTag string
		tags       []string
		want       string
	}{
		{"container tag wins", container.Summary{Image: "alpine:3.20"}, "alpine:${TAG}", []string{"alpine:3.20"}, "alpine:3.20"},
		{"id falls back to compose tag", container.Summary{Image: "bbb26ce15bf1"}, "localhost:5050/demo:latest", nil, "localhost:5050/demo:latest"},
		{"id and unresolved compose uses local tag", container.Summary{Image: "sha256:bbb26ce15bf1"}, "alpine:${TAG}", []string{"alpine:3.20"}, "alpine:3.20"},
		{"digest ref is not a tag", container.Summary{Image: "nginx@sha256:abc"}, "nginx:latest", nil, "nginx:latest"},
		{"no usable tag", container.Summary{Image: "sha256:bbb26ce15bf1"}, "", nil, ""},
	}
	for _, c := range cases {
		if got := containerImageTag(c.summary, c.composeTag, ImageInfo{Tags: c.tags}); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}

func TestContainerStaleFallsBackToComposeTag(t *testing.T) {
	c, err := NewClient("unix:///nonexistent.sock", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	s := NewStacks(c, t.TempDir(), "", "localhost", "")
	images := map[string]ImageInfo{
		"abcd12345678": {ID: "abcd12345678", RepoDigests: []string{"demo@sha256:remote"}},
	}
	summary := container.Summary{
		Image:   "abcd12345678",
		ImageID: "sha256:abcd1234567890abcdef",
	}
	c.digests = map[string]remoteDigestEntry{
		"demo:latest": {digest: "sha256:remote", at: time.Now()},
	}
	if got := s.containerStale(context.Background(), summary, images, "demo:latest"); got != StaleUpToDate {
		t.Errorf("got %q, want %q", got, StaleUpToDate)
	}
}
