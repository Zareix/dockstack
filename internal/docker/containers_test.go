package docker

import (
	"context"
	"testing"
)

func TestListRunningContainersWithoutProject(t *testing.T) {
	c, err := NewClient("unix:///nonexistent.sock", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.ListRunningContainers(context.Background(), ""); err == nil {
		t.Fatal("expected error from unreachable docker host")
	}
}
