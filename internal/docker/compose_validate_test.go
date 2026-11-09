package docker

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func skipWithoutCompose(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("docker"); err != nil {
		t.Skip("docker CLI not available")
	}
	if err := exec.Command("docker", "compose", "version").Run(); err != nil {
		t.Skip("docker compose not available")
	}
}

func writeCompose(t *testing.T, root, stack, content string) {
	t.Helper()
	dir := filepath.Join(root, stack)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "compose.yaml"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestCleanComposeOutput(t *testing.T) {
	raw := "time=\"2026-01-01\" level=error msg=\"invalid compose\"\n\n  plain error  \n"
	got := cleanComposeOutput(raw)
	want := []string{"invalid compose", "plain error"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("line %d: got %q, want %q", i, got[i], want[i])
		}
	}
}

func TestCleanComposeOutputStripsValidationPath(t *testing.T) {
	raw := "validating /home/app/stacks/demo/compose.yaml: services.app.build additional properties 'ttt' not allowed\n"
	got := cleanComposeOutput(raw)
	want := "services.app.build additional properties 'ttt' not allowed"
	if len(got) != 1 || got[0] != want {
		t.Fatalf("got %v, want [%q]", got, want)
	}
}

func TestCleanComposeOutputUnescapesQuotes(t *testing.T) {
	raw := `time="2026-01-01" level=error msg="The \"foo\" setting is invalid."`
	got := cleanComposeOutput(raw)
	want := `The "foo" setting is invalid.`
	if len(got) != 1 || got[0] != want {
		t.Fatalf("got %v, want [%q]", got, want)
	}
}

func TestCleanComposeOutputDropsMissingVariableWarning(t *testing.T) {
	raw := `time="2026-01-01" level=warning msg="The \"TEST\" variable is not set. Defaulting to a blank string."`
	if got := cleanComposeOutput(raw); len(got) != 0 {
		t.Fatalf("got %v, want no warning", got)
	}
}

func TestValidateComposeValid(t *testing.T) {
	skipWithoutCompose(t)
	root := t.TempDir()
	writeCompose(t, root, "app", "services:\n  app:\n    image: alpine:3.20\n")
	s := NewStacks(nil, root, "", "localhost", "")

	got := s.ValidateCompose(t.Context(), "app")
	if !got.Validation.ComposeAvailable {
		t.Fatalf("compose should be available: %+v", got)
	}
	if !got.Validation.Valid || len(got.Validation.Errors) != 0 {
		t.Fatalf("expected valid compose: %+v", got)
	}
	if got.Validation.Errors == nil || got.Validation.Warnings == nil {
		t.Fatalf("errors and warnings must be non-nil arrays: %+v", got)
	}
	if !strings.Contains(got.Resolved, "services:") {
		t.Fatalf("expected resolved config: %q", got.Resolved)
	}
}

func TestValidateComposeInvalid(t *testing.T) {
	skipWithoutCompose(t)
	root := t.TempDir()
	writeCompose(t, root, "app", "services:\n  app:\n    image: alpine\n   ports: ['80:80']\n")
	s := NewStacks(nil, root, "", "localhost", "")

	got := s.ValidateCompose(t.Context(), "app")
	if !got.Validation.ComposeAvailable {
		t.Fatalf("compose should be available: %+v", got)
	}
	if got.Validation.Valid {
		t.Fatalf("expected invalid compose: %+v", got)
	}
	if len(got.Validation.Errors) == 0 {
		t.Fatalf("expected errors: %+v", got)
	}
}
