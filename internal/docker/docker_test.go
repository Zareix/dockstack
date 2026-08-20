package docker

import "testing"

func TestRegistryFromTag(t *testing.T) {
	cases := map[string]string{
		"nginx:latest":                "https://index.docker.io/v1/",
		"ghcr.io/org/repo:tag":        "ghcr.io",
		"localhost:5000/foo/bar:tag":  "localhost:5000",
		"registry.example.com/a/b:v1": "registry.example.com",
		"library/alpine":              "https://index.docker.io/v1/",
	}
	for tag, want := range cases {
		if got := registryFromTag(tag); got != want {
			t.Errorf("registryFromTag(%q) = %q, want %q", tag, got, want)
		}
	}
}

func TestFormatImageTag(t *testing.T) {
	cases := map[string]string{
		"nginx:latest":            "nginx:latest",
		"sha256:0123456789abcdef": "0123456789ab",
		"sha256:abc":              "abc",
	}
	for in, want := range cases {
		if got := formatImageTag(in); got != want {
			t.Errorf("formatImageTag(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestContainerStateToStatus(t *testing.T) {
	cases := []struct {
		state, status string
		want          StackStatus
	}{
		{"running", "Up 2 hours (healthy)", StackHealthy},
		{"running", "Up 2 hours (unhealthy)", StackUnhealthy},
		{"running", "Up 2 hours (health: starting)", StackStarting},
		{"running", "Up 2 hours", StackRunning},
		{"restarting", "Restarting", StackRestarting},
		{"exited", "Exited (0)", StackStopped},
		{"paused", "Up (paused)", StackStopped},
		{"dead", "Dead", StackDown},
		{"created", "Created", StackDown},
		{"removing", "Removing", StackDown},
		{"weird", "Weird", StackUnknown},
	}
	for _, c := range cases {
		if got := containerStateToStatus(c.state, c.status); got != c.want {
			t.Errorf("containerStateToStatus(%q, %q) = %q, want %q", c.state, c.status, got, c.want)
		}
	}
}

func TestGetContainerURLs(t *testing.T) {
	// Godoxy
	urls := getContainerURLs(map[string]string{"proxy.aliases": "app, sub.example.com"}, "example.com")
	if len(urls) != 2 || urls[0] != "https://app.example.com" || urls[1] != "https://sub.example.com" {
		t.Fatalf("godoxy urls: %v", urls)
	}
	// Traefik
	urls = getContainerURLs(map[string]string{
		"traefik.http.routers.web.rule": "Host(`app.example.com`) || PathPrefix(`/api`)",
	}, "")
	if len(urls) != 1 || urls[0] != "https://app.example.com" {
		t.Fatalf("traefik urls: %v", urls)
	}
	// Nothing
	if urls := getContainerURLs(map[string]string{"foo": "bar"}, ""); urls != nil {
		t.Fatalf("expected nil urls, got %v", urls)
	}
}

func TestGetDockerEnvStripsSecrets(t *testing.T) {
	t.Setenv("APP_URL", "https://x")
	t.Setenv("ADMIN_EMAIL", "a@b.c")
	t.Setenv("AUTH_SECRET", "topsecret")
	t.Setenv("DOCKER_HOST", "unix:///tmp/x")
	t.Setenv("KEEP_ME", "yes")

	env := getDockerEnv()
	joined := map[string]bool{}
	for _, kv := range env {
		key := kv
		for i := 0; i < len(kv); i++ {
			if kv[i] == '=' {
				key = kv[:i]
				break
			}
		}
		joined[key] = true
	}
	for _, banned := range []string{"APP_URL", "ADMIN_EMAIL", "AUTH_SECRET"} {
		if joined[banned] {
			t.Errorf("env var %s should be stripped", banned)
		}
	}
	if !joined["DOCKER_HOST"] || !joined["KEEP_ME"] {
		t.Error("expected passthrough vars present")
	}
}
