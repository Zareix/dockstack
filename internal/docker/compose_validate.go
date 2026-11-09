package docker

import (
	"bytes"
	"context"
	"errors"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

const (
	composeValidateTimeout  = 10 * time.Second
	composeValidateMaxLines = 20
)

var missingEnvVarWarningRe = regexp.MustCompile(`^The "[A-Za-z_][A-Za-z0-9_]*" variable is not set\. Defaulting to a blank string\.$`)

func cleanComposeOutput(raw string) []string {
	out := []string{}
	for line := range strings.SplitSeq(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if idx := strings.Index(line, `msg="`); idx >= 0 {
			line = logfmtMessage(line[idx+len(`msg="`):])
		}
		if rest, ok := strings.CutPrefix(line, "validating "); ok {
			if _, msg, ok := strings.Cut(rest, ": "); ok {
				line = msg
			}
		}
		if missingEnvVarWarningRe.MatchString(line) {
			continue
		}
		out = append(out, line)
		if len(out) == composeValidateMaxLines {
			break
		}
	}
	return out
}

func logfmtMessage(raw string) string {
	var b strings.Builder
	escaped := false
	for _, r := range raw {
		if escaped {
			switch r {
			case 'n':
				b.WriteByte('\n')
			case 't':
				b.WriteByte('\t')
			case 'r':
				b.WriteByte('\r')
			default:
				b.WriteRune(r)
			}
			escaped = false
			continue
		}
		if r == '\\' {
			escaped = true
			continue
		}
		if r == '"' {
			break
		}
		b.WriteRune(r)
	}
	return b.String()
}

func newComposeDiagnostics() ComposeDiagnostics {
	return ComposeDiagnostics{
		Validation: ComposeValidation{
			Valid:            true,
			Errors:           []string{},
			Warnings:         []string{},
			ComposeAvailable: true,
		},
		Env: ComposeEnvUsage{Used: []string{}, Unused: []string{}, Missing: []string{}},
	}
}

func (s *Stacks) ValidateCompose(ctx context.Context, stackName string) ComposeDiagnostics {
	diags := newComposeDiagnostics()
	composePath, err := s.FindComposePath(stackName)
	if err != nil {
		diags.Validation.Valid = false
		diags.Validation.Errors = append(diags.Validation.Errors, err.Error())
		return diags
	}
	compose, err := os.ReadFile(composePath)
	if err != nil {
		diags.Validation.Valid = false
		diags.Validation.Errors = append(diags.Validation.Errors, "failed to read compose file")
		return diags
	}
	var env *string
	if envPath := s.FindEnvPath(stackName); envPath != "" {
		if data, err := os.ReadFile(envPath); err == nil {
			content := string(data)
			env = &content
		}
	}
	return s.ValidateComposeContent(ctx, stackName, string(compose), env)
}

func (s *Stacks) ValidateComposeContent(ctx context.Context, stackName, compose string, env *string) ComposeDiagnostics {
	diags := newComposeDiagnostics()
	diags.Env = composeEnvUsage(compose, env)
	if strings.TrimSpace(compose) == "" {
		diags.Validation.Valid = false
		diags.Validation.Errors = append(diags.Validation.Errors, "compose content is required")
		return diags
	}
	if _, err := exec.LookPath("docker"); errors.Is(err, exec.ErrNotFound) {
		diags.Validation.ComposeAvailable = false
		diags.Validation.Warnings = append(diags.Validation.Warnings, "docker compose CLI not found; validation skipped")
		return diags
	}

	envFile, err := os.CreateTemp("", "dockstack-env-")
	if err != nil {
		diags.Validation.Valid = false
		diags.Validation.Errors = append(diags.Validation.Errors, "failed to prepare validation")
		return diags
	}
	defer os.Remove(envFile.Name())
	if env != nil {
		_, _ = envFile.WriteString(*env)
	}
	_ = envFile.Close()

	ctx, cancel := context.WithTimeout(ctx, composeValidateTimeout)
	defer cancel()
	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, "docker", s.composeValidateArgs(stackName, envFile.Name())...)
	cmd.Env = getDockerEnv()
	cmd.Dir = s.stackDir(stackName)
	cmd.Stdin = strings.NewReader(compose)
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		diags.Validation.Valid = false
		diags.Validation.Errors = cleanComposeOutput(stderr.String())
		if len(diags.Validation.Errors) == 0 {
			diags.Validation.Errors = append(diags.Validation.Errors, err.Error())
		}
		return diags
	}

	diags.Validation.Warnings = cleanComposeOutput(stderr.String())
	diags.Resolved = stdout.String()
	diags.Validation.Warnings = append(diags.Validation.Warnings, composeStaticWarnings(diags.Resolved)...)
	return diags
}

func (s *Stacks) composeValidateArgs(stackName, envFile string) []string {
	args := []string{}
	if s.hasConfigFile() {
		args = append(args, "--config", s.configDir)
	}
	args = append(args,
		"compose",
		"--file", "-",
		"--project-directory", s.stackDir(stackName),
		"--env-file", envFile,
		"config",
	)
	return args
}
