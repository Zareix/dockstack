package docker

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os/exec"
	"strings"
	"time"
)

const (
	composeValidateTimeout  = 10 * time.Second
	composeValidateMaxLines = 20
)

func cleanComposeOutput(raw string) []string {
	out := []string{}
	for line := range strings.SplitSeq(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if _, msg, ok := strings.Cut(line, `msg="`); ok {
			if end := strings.Index(msg, `"`); end >= 0 {
				line = msg[:end]
			}
		}
		out = append(out, line)
		if len(out) == composeValidateMaxLines {
			break
		}
	}
	return out
}

func (s *Stacks) ValidateCompose(ctx context.Context, stackName string) ComposeValidation {
	validation := ComposeValidation{
		Valid:            true,
		Errors:           []string{},
		Warnings:         []string{},
		ComposeAvailable: true,
	}
	if _, err := exec.LookPath("docker"); errors.Is(err, exec.ErrNotFound) {
		validation.ComposeAvailable = false
		validation.Warnings = append(validation.Warnings, "docker compose CLI not found; validation skipped")
		return validation
	}
	cmdArgs, err := s.composeCommand(stackName, "config")
	if err != nil {
		validation.Valid = false
		validation.Errors = append(validation.Errors, err.Error())
		return validation
	}
	ctx, cancel := context.WithTimeout(ctx, composeValidateTimeout)
	defer cancel()
	var stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, "docker", cmdArgs...)
	cmd.Env = getDockerEnv()
	cmd.Stdout = io.Discard
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		validation.Valid = false
		validation.Errors = cleanComposeOutput(stderr.String())
		if len(validation.Errors) == 0 {
			validation.Errors = append(validation.Errors, err.Error())
		}
		return validation
	}
	validation.Warnings = cleanComposeOutput(stderr.String())
	return validation
}
