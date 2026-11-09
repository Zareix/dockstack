package docker

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestComposeEnvUsage(t *testing.T) {
	compose := `services:
  app:
    image: nginx
    environment:
      A: ${DOCKSTACK_TEST_A}
      B: $DOCKSTACK_TEST_B
      C: $$DOCKSTACK_TEST_C
      D: ${DOCKSTACK_TEST_D:-fallback}
      E: ${DOCKSTACK_TEST_E?required}
      F: ${DOCKSTACK_TEST_OPT:+optional}
`
	env := "DOCKSTACK_TEST_A=1\nDOCKSTACK_TEST_B=2\nexport DOCKSTACK_TEST_UNUSED=3\n"
	got := composeEnvUsage(compose, &env)
	if strings.Join(got.Used, ",") != "DOCKSTACK_TEST_A,DOCKSTACK_TEST_B,DOCKSTACK_TEST_D,DOCKSTACK_TEST_E,DOCKSTACK_TEST_OPT" {
		t.Fatalf("used: got %v", got.Used)
	}
	if strings.Join(got.Unused, ",") != "DOCKSTACK_TEST_UNUSED" {
		t.Fatalf("unused: got %v", got.Unused)
	}
	if strings.Join(got.Missing, ",") != "DOCKSTACK_TEST_E" {
		t.Fatalf("missing: got %v", got.Missing)
	}
}

func TestComposeEnvUsageProcessEnvironment(t *testing.T) {
	t.Setenv("DOCKSTACK_TEST_PROCESS", "1")
	got := composeEnvUsage("command: echo $DOCKSTACK_TEST_PROCESS\n", nil)
	if len(got.Missing) != 0 {
		t.Fatalf("missing: got %v", got.Missing)
	}
	if strings.Join(got.Used, ",") != "DOCKSTACK_TEST_PROCESS" {
		t.Fatalf("used: got %v", got.Used)
	}
}

func TestComposeEnvUsageIgnoresEscapedVariables(t *testing.T) {
	got := composeEnvUsage("command: echo $${NOT_A_VAR}\n", nil)
	if len(got.Used) != 0 {
		t.Fatalf("used: got %v", got.Used)
	}
}

func TestComposeStaticWarningsInvalidImages(t *testing.T) {
	resolved := `services:
  valid:
    image: nginx:1.25
  digest:
    image: ghcr.io/acme/app@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  invalid:
    image: "Foo Bar"
  build-only:
    build: {}
`
	warnings := composeStaticWarnings(resolved)
	if len(warnings) != 1 {
		t.Fatalf("warnings: got %v", warnings)
	}
	if !strings.Contains(warnings[0], `service "invalid" has invalid image reference "Foo Bar"`) {
		t.Fatalf("unexpected warning: %q", warnings[0])
	}
}

func TestComposeStaticWarningsDuplicatePorts(t *testing.T) {
	resolved := `services:
  web:
    ports:
      - host_ip: 127.0.0.1
        published: "8080"
        protocol: tcp
  db:
    ports:
      - published: "8080"
        protocol: tcp
      - published: "8080"
        protocol: udp
`
	warnings := composeStaticWarnings(resolved)
	if len(warnings) != 1 {
		t.Fatalf("warnings: got %v", warnings)
	}
	if !strings.Contains(warnings[0], `host port 8080/tcp is published by services "db" and "web"`) {
		t.Fatalf("unexpected warning: %q", warnings[0])
	}
}

func TestComposeStaticWarningsSameServicePort(t *testing.T) {
	resolved := `services:
  web:
    ports:
      - published: "8080"
        protocol: tcp
      - published: "8080"
        protocol: tcp
`
	warnings := composeStaticWarnings(resolved)
	if len(warnings) != 1 || !strings.Contains(warnings[0], "more than once") {
		t.Fatalf("warnings: got %v", warnings)
	}
}

func TestComposeStaticWarningsDistinctHostIPsDoNotConflict(t *testing.T) {
	resolved := `services:
  a:
    ports:
      - host_ip: 127.0.0.1
        published: "8080"
        protocol: tcp
  b:
    ports:
      - host_ip: 127.0.0.2
        published: "8080"
        protocol: tcp
`
	if warnings := composeStaticWarnings(resolved); len(warnings) != 0 {
		t.Fatalf("warnings: got %v", warnings)
	}
}

func TestParsePortRange(t *testing.T) {
	cases := []struct {
		value string
		start int
		end   int
		ok    bool
	}{
		{"8080", 8080, 8080, true},
		{"8000-8010", 8000, 8010, true},
		{"bad", 0, 0, false},
		{"8010-8000", 0, 0, false},
	}
	for _, c := range cases {
		start, end, ok := parsePortRange(c.value)
		if start != c.start || end != c.end || ok != c.ok {
			t.Errorf("%q: got (%d, %d, %v)", c.value, start, end, ok)
		}
	}
}

func TestValidateComposeReportsStaticWarnings(t *testing.T) {
	skipWithoutCompose(t)
	root := t.TempDir()
	writeCompose(t, root, "app", `services:
  a:
    image: "Foo Bar"
  b:
    image: nginx
    ports: ["8080:80"]
  c:
    image: nginx
    ports: ["8080:81"]
`)
	s := NewStacks(nil, root, "", "localhost", "")
	got := s.ValidateCompose(t.Context(), "app")
	if !got.Validation.Valid {
		t.Fatalf("expected valid compose: %+v", got)
	}
	warnings := strings.Join(got.Validation.Warnings, "\n")
	if !strings.Contains(warnings, `service "a" has invalid image reference "Foo Bar"`) {
		t.Fatalf("missing image warning: %q", warnings)
	}
	if !strings.Contains(warnings, "host port 8080/tcp is published by services") {
		t.Fatalf("missing port warning: %q", warnings)
	}
}

func TestValidateComposeContentUsesDraftEnv(t *testing.T) {
	skipWithoutCompose(t)
	root := t.TempDir()
	writeCompose(t, root, "app", "services:\n  app:\n    image: alpine:${TAG:?tag required}\n")
	if err := os.WriteFile(filepath.Join(root, "app", ".env"), []byte("TAG=3.19\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	s := NewStacks(nil, root, "", "localhost", "")

	draftEnv := "TAG=3.20\n"
	got := s.ValidateComposeContent(t.Context(), "app", "services:\n  app:\n    image: alpine:${TAG:?tag required}\n", &draftEnv)
	if !got.Validation.Valid {
		t.Fatalf("expected valid compose: %+v", got)
	}
	if strings.Join(got.Env.Used, ",") != "TAG" {
		t.Fatalf("used: got %v", got.Env.Used)
	}
	if len(got.Env.Missing) != 0 {
		t.Fatalf("missing: got %v", got.Env.Missing)
	}
}
