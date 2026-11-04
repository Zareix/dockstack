package docker

import (
	"context"
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
