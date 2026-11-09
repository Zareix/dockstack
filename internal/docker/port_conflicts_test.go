package docker

import (
	"strings"
	"testing"

	"github.com/docker/docker/api/types/container"
)

func TestContainerPortWarnings(t *testing.T) {
	bindings := []hostBinding{{service: "web", protocol: "tcp", start: 8080, end: 8080}}
	containers := []container.Summary{
		{
			ID:     "1",
			Names:  []string{"/redis"},
			Labels: map[string]string{"com.docker.compose.project": "other"},
			Ports:  []container.Port{{PublicPort: 8080, Type: "tcp", IP: "0.0.0.0"}},
		},
		{
			ID:     "2",
			Names:  []string{"/self"},
			Labels: map[string]string{"com.docker.compose.project": "demo"},
			Ports:  []container.Port{{PublicPort: 8080, Type: "tcp"}},
		},
		{
			ID:     "3",
			Names:  []string{"/udp"},
			Labels: map[string]string{"com.docker.compose.project": "other"},
			Ports:  []container.Port{{PublicPort: 8080, Type: "udp"}},
		},
	}
	warnings := containerPortWarnings("demo", bindings, containers)
	if len(warnings) != 1 {
		t.Fatalf("warnings: got %v", warnings)
	}
	if !strings.Contains(warnings[0], `already used by container "redis" (stack "other")`) {
		t.Fatalf("unexpected warning: %q", warnings[0])
	}
	if !strings.Contains(warnings[0], `service "web"`) {
		t.Fatalf("missing service name: %q", warnings[0])
	}
}

func TestContainerPortWarningsHostIPs(t *testing.T) {
	cases := []struct {
		name        string
		composeIP   string
		containerIP string
		want        bool
	}{
		{"same specific", "127.0.0.1", "127.0.0.1", true},
		{"different specific", "127.0.0.1", "127.0.0.2", false},
		{"compose wildcard", "", "127.0.0.1", true},
		{"container wildcard", "127.0.0.1", "0.0.0.0", true},
		{"ipv6 wildcard", "::", "::1", true},
	}
	for _, c := range cases {
		bindings := []hostBinding{{service: "web", protocol: "tcp", hostIP: c.composeIP, start: 8080, end: 8080}}
		containers := []container.Summary{{
			ID:    "1",
			Names: []string{"/redis"},
			Ports: []container.Port{{PublicPort: 8080, Type: "tcp", IP: c.containerIP}},
		}}
		got := len(containerPortWarnings("demo", bindings, containers)) > 0
		if got != c.want {
			t.Errorf("%s: got conflict=%v, want %v", c.name, got, c.want)
		}
	}
}

func TestContainerPortWarningsRange(t *testing.T) {
	bindings := []hostBinding{{service: "web", protocol: "tcp", start: 8000, end: 8010}}
	containers := []container.Summary{{
		ID:    "1",
		Names: []string{"/redis"},
		Ports: []container.Port{{PublicPort: 8005, Type: "tcp"}},
	}}
	warnings := containerPortWarnings("demo", bindings, containers)
	if len(warnings) != 1 {
		t.Fatalf("warnings: got %v", warnings)
	}
}
