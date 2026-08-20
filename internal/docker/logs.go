package docker

import (
	"bufio"
	"context"
	"io"
	"os/exec"
	"strings"
	"sync"
)

// StreamStackLogs tails docker logs for every container in a stack and emits
// parsed LogEntries on the returned channel. The channel is closed when all
// log processes exit.
func (s *Stacks) StreamStackLogs(ctx context.Context, stackName string) (<-chan LogEntry, error) {
	containers, err := s.client.ListContainers(ctx, false, stackName)
	if err != nil {
		return nil, err
	}

	out := make(chan LogEntry)

	var wg sync.WaitGroup
	for _, c := range containers {
		containerName := c.ID
		if len(c.Names) > 0 {
			containerName = strings.TrimPrefix(c.Names[0], "/")
		} else if len(c.ID) > 12 {
			containerName = c.ID[:12]
		}
		wg.Add(1)
		go func(cName string, containerID string) {
			defer wg.Done()
			args := []string{}
			if s.hasConfigFile() {
				args = append(args, "--config", s.configDir)
			}
			args = append(args, "logs", "--follow", "--timestamps", "--tail", "1000", containerID)
			cmd := exec.CommandContext(ctx, "docker", args...)
			cmd.Env = getDockerEnv()
			stdout, err := cmd.StdoutPipe()
			if err != nil {
				return
			}
			stderr, err := cmd.StderrPipe()
			if err != nil {
				return
			}
			if err := cmd.Start(); err != nil {
				return
			}
			var streamWG sync.WaitGroup
			streamWG.Add(2)
			emit := func(r io.Reader, stream string) {
				defer streamWG.Done()
				sc := bufio.NewScanner(r)
				sc.Buffer(make([]byte, 64*1024), 1024*1024)
				for sc.Scan() {
					line := sc.Text()
					if line == "" {
						continue
					}
					entry := LogEntry{
						ContainerName: cName,
						Message:       line,
						Stream:        stream,
					}
					if idx := strings.Index(line, " "); idx > -1 {
						entry.Timestamp = line[:idx]
						entry.Message = line[idx+1:]
					}
					select {
					case out <- entry:
					case <-ctx.Done():
						return
					}
				}
			}
			go emit(stdout, "stdout")
			go emit(stderr, "stderr")
			streamWG.Wait()
			cmd.Wait()
		}(containerName, c.ID)
	}

	go func() {
		wg.Wait()
		close(out)
	}()

	return out, nil
}
