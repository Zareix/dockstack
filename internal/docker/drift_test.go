package docker

import (
	"testing"

	"github.com/docker/docker/api/types/container"
)

func TestParseServiceHashes(t *testing.T) {
	stdout := "app 8b08690bc131\nweb f00ba4\n\nwarning line without hash\n"
	got := parseServiceHashes(stdout)
	if len(got) != 2 {
		t.Fatalf("got %d hashes, want 2: %v", len(got), got)
	}
	if got["app"] != "8b08690bc131" || got["web"] != "f00ba4" {
		t.Errorf("unexpected hashes: %v", got)
	}
}

func TestDriftFromContainers(t *testing.T) {
	hashes := map[string]string{"app": "aaa", "web": "bbb"}
	summary := func(service, hash, oneoff string) container.Summary {
		labels := map[string]string{
			"com.docker.compose.service":     service,
			"com.docker.compose.config-hash": hash,
		}
		if oneoff != "" {
			labels["com.docker.compose.oneoff"] = oneoff
		}
		return container.Summary{Labels: labels}
	}

	cases := []struct {
		name       string
		containers []container.Summary
		want       DriftStatus
	}{
		{"all matching", []container.Summary{summary("app", "aaa", ""), summary("web", "bbb", "")}, DriftInSync},
		{"one mismatch", []container.Summary{summary("app", "aaa", ""), summary("web", "old", "")}, DriftOutdated},
		{"oneoff ignored", []container.Summary{summary("app", "aaa", ""), summary("app", "old", "True")}, DriftInSync},
		{"missing hash ignored", []container.Summary{summary("app", "aaa", ""), summary("web", "", "")}, DriftInSync},
		{"unknown service ignored", []container.Summary{summary("app", "aaa", ""), summary("gone", "old", "")}, DriftInSync},
		{"only oneoff", []container.Summary{summary("app", "old", "True")}, DriftUnknown},
		{"no comparable container", []container.Summary{summary("gone", "aaa", "")}, DriftUnknown},
		{"no containers", nil, DriftUnknown},
	}
	for _, c := range cases {
		if got := driftFromContainers(c.containers, hashes); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}
