package docker

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
)

func TestComposeImageRefs(t *testing.T) {
	cfg := resolvedComposeConfig{Services: map[string]resolvedService{
		"app":   {Image: "nginx:1.25"},
		"build": {},
		"bad":   {Image: "Foo Bar"},
	}}
	refs := composeImageRefs(cfg)
	if len(refs) != 1 || refs[0].Service != "app" || refs[0].Image != "nginx:1.25" {
		t.Fatalf("refs: got %#v", refs)
	}
}

func TestResolveImageWarnings(t *testing.T) {
	refs := []composeImageRef{
		{Service: "a", Image: "nginx:1.25"},
		{Service: "b", Image: "nginx:1.25"},
		{Service: "c", Image: "private:tag"},
	}
	calls := map[string]int{}
	resolve := func(_ context.Context, image string) (string, error) {
		calls[image]++
		if image == "private:tag" {
			return "", errors.New("unauthorized")
		}
		return "sha256:abcdef", nil
	}

	warnings := resolveImageWarnings(context.Background(), refs, resolve)
	if calls["nginx:1.25"] != 1 {
		t.Fatalf("expected shared image to be resolved once, got %d calls", calls["nginx:1.25"])
	}
	if len(warnings) != 1 || !strings.Contains(warnings[0], `image "private:tag" for service "c"`) {
		t.Fatalf("warnings: got %v", warnings)
	}
}

func TestResolveImageWarningsSkipsRegistryUnavailable(t *testing.T) {
	refs := []composeImageRef{{Service: "a", Image: "nginx:1.25"}}
	resolve := func(context.Context, string) (string, error) {
		return "", fmt.Errorf("%w: dial unix: connection refused", errRegistryUnavailable)
	}
	if warnings := resolveImageWarnings(context.Background(), refs, resolve); len(warnings) != 0 {
		t.Fatalf("warnings: got %v", warnings)
	}
}
