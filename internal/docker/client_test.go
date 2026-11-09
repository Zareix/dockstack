package docker

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestRemoteDigestCachedHit(t *testing.T) {
	c, err := NewClient("unix:///nonexistent.sock", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	c.digests = map[string]remoteDigestEntry{
		"nginx:latest": {digest: "sha256:cached", at: time.Now()},
	}
	digest, ok := c.RemoteDigestCached(context.Background(), "nginx:latest")
	if !ok || digest != "sha256:cached" {
		t.Fatalf("got %q, %v; want cached digest", digest, ok)
	}
}

func TestRemoteDigestCachedExpired(t *testing.T) {
	c, err := NewClient("unix:///nonexistent.sock", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	c.digests = map[string]remoteDigestEntry{
		"nginx:latest": {digest: "sha256:old", at: time.Now().Add(-2 * remoteDigestTTL)},
	}
	if digest, ok := c.RemoteDigestCached(context.Background(), "nginx:latest"); ok {
		t.Fatalf("expected expired entry to be refetched, got %q", digest)
	}
}

func TestRemoteDigestCachedIgnoresErrorEntry(t *testing.T) {
	c, err := NewClient("unix:///nonexistent.sock", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	c.digests = map[string]remoteDigestEntry{
		"nginx:latest": {err: "not found", at: time.Now()},
	}
	if digest, ok := c.RemoteDigestCached(context.Background(), "nginx:latest"); ok {
		t.Fatalf("expected error entry to be ignored, got %q", digest)
	}
}

func TestResolveImageCached(t *testing.T) {
	c, err := NewClient("unix:///nonexistent.sock", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	c.digests = map[string]remoteDigestEntry{
		"nginx:latest": {digest: "sha256:cached", at: time.Now()},
	}
	digest, err := c.ResolveImage(context.Background(), "nginx:latest")
	if err != nil || digest != "sha256:cached" {
		t.Fatalf("got %q, %v; want cached digest", digest, err)
	}
}

func TestResolveImageCachedError(t *testing.T) {
	c, err := NewClient("unix:///nonexistent.sock", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	c.digests = map[string]remoteDigestEntry{
		"private:tag": {err: "unauthorized", at: time.Now()},
	}
	if _, err := c.ResolveImage(context.Background(), "private:tag"); err == nil || !strings.Contains(err.Error(), "unauthorized") {
		t.Fatalf("got %v, want unauthorized", err)
	}
}

func TestRegistryError(t *testing.T) {
	cases := []struct {
		status int
		body   string
		want   string
	}{
		{404, `{"message":"manifest unknown"}`, "manifest unknown"},
		{404, `{}`, "not found"},
		{401, `{}`, "unauthorized"},
		{403, `{"message":"errors:\ndenied: nope"}`, "errors: denied: nope"},
		{500, `{"message":"boom"}`, "registry error: boom"},
	}
	for _, c := range cases {
		err := registryError(c.status, []byte(c.body))
		if err == nil || err.Error() != c.want {
			t.Errorf("%d: got %v, want %q", c.status, err, c.want)
		}
	}
}

func TestInvalidateRemoteDigests(t *testing.T) {
	c, err := NewClient("unix:///nonexistent.sock", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	c.digests = map[string]remoteDigestEntry{
		"nginx:latest": {digest: "sha256:cached", at: time.Now()},
	}
	c.InvalidateRemoteDigests()
	if c.digests != nil {
		t.Fatal("expected digest cache to be cleared")
	}
}
