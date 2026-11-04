package docker

import (
	"bytes"
	"context"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
)

const driftCheckTimeout = 10 * time.Second

func parseServiceHashes(stdout string) map[string]string {
	out := map[string]string{}
	for line := range strings.SplitSeq(stdout, "\n") {
		fields := strings.Fields(line)
		if len(fields) != 2 {
			continue
		}
		out[fields[0]] = fields[1]
	}
	return out
}

func driftFromContainers(containers []container.Summary, hashes map[string]string) DriftStatus {
	compared := 0
	for _, c := range containers {
		if c.Labels["com.docker.compose.oneoff"] == "True" {
			continue
		}
		want, ok := hashes[c.Labels["com.docker.compose.service"]]
		if !ok {
			continue
		}
		got := c.Labels["com.docker.compose.config-hash"]
		if got == "" {
			continue
		}
		compared++
		if got != want {
			return DriftOutdated
		}
	}
	if compared == 0 {
		return DriftUnknown
	}
	return DriftInSync
}

func (s *Stacks) stackDrift(ctx context.Context, name string) DriftStatus {
	containers, err := s.client.ListContainers(ctx, true, name)
	if err != nil || len(containers) == 0 {
		return DriftUnknown
	}
	cmdArgs, err := s.composeCommand(name, "config", "--hash=*")
	if err != nil {
		return DriftUnknown
	}
	ctx, cancel := context.WithTimeout(ctx, driftCheckTimeout)
	defer cancel()
	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, "docker", cmdArgs...)
	cmd.Env = getDockerEnv()
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return DriftUnknown
	}
	return driftFromContainers(containers, parseServiceHashes(stdout.String()))
}

func (s *Stacks) CheckStacksDrift(ctx context.Context) (map[string]DriftStatus, error) {
	names, err := s.ListStacks(ctx)
	if err != nil {
		return nil, err
	}
	out := make(map[string]DriftStatus, len(names))
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 4)
	for _, name := range names {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			status := s.stackDrift(ctx, name)
			mu.Lock()
			out[name] = status
			mu.Unlock()
		}()
	}
	wg.Wait()
	return out, nil
}
