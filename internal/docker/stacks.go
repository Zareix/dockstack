package docker

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"gopkg.in/yaml.v3"
)

var ComposeFilenames = []string{
	"compose.yaml",
	"compose.yml",
	"docker-compose.yml",
	"docker-compose.yaml",
}

const heartbeat = "\u200b"

type Stacks struct {
	client     *Client
	stacksDir  string
	configDir  string
	serverHost string
	baseDomain string
}

func NewStacks(client *Client, stacksDir, configDir, serverHost, baseDomain string) *Stacks {
	return &Stacks{
		client:     client,
		stacksDir:  stacksDir,
		configDir:  configDir,
		serverHost: serverHost,
		baseDomain: baseDomain,
	}
}

func (s *Stacks) Dir() string { return s.stacksDir }

func (s *Stacks) stackDir(name string) string {
	return filepath.Join(s.stacksDir, name)
}

func (s *Stacks) FindComposePath(stackName string) (string, error) {
	dir := s.stackDir(stackName)
	for _, f := range ComposeFilenames {
		path := filepath.Join(dir, f)
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}
	return "", fmt.Errorf("no compose file found in %s", stackName)
}

func (s *Stacks) FindEnvPath(stackName string) string {
	path := filepath.Join(s.stackDir(stackName), ".env")
	if _, err := os.Stat(path); err == nil {
		return path
	}
	return ""
}

func (s *Stacks) ListStacks(ctx context.Context) ([]string, error) {
	entries, err := os.ReadDir(s.stacksDir)
	if err != nil {
		return nil, err
	}
	var names []string
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, ".") || strings.HasPrefix(name, "_") {
			continue
		}
		if !e.IsDir() {
			continue
		}
		names = append(names, name)
	}
	sort.Strings(names)
	return names, nil
}

func (s *Stacks) StackExists(ctx context.Context, name string) (bool, error) {
	names, err := s.ListStacks(ctx)
	if err != nil {
		return false, err
	}
	for _, n := range names {
		if n == name {
			return true, nil
		}
	}
	return false, nil
}

// getDockerEnv returns the environment for child processes, stripping
// app-specific variables so they don't leak into compose.
func getDockerEnv() []string {
	deny := map[string]bool{
		"APP_URL": true, "ADMIN_EMAIL": true, "APP_TITLE": true, "INSTANCE_NAME": true,
		"SERVER_HOST": true, "STACKS_DIR": true, "DATABASE_PATH": true,
		"OAUTH_PROVIDER_ID": true, "OAUTH_CLIENT_ID": true, "OAUTH_CLIENT_SECRET": true,
		"OAUTH_DISCOVERY_URL": true, "DOCKER_SYSTEM_PRUNE_CRON": true,
		"DOCKER_SYSTEM_PRUNE_INCLUDE_VOLUMES": true, "REDEPLOY_SKIP": true,
		"AUTH_SECRET": true,
	}
	var out []string
	for _, kv := range os.Environ() {
		key, _, _ := strings.Cut(kv, "=")
		if deny[key] {
			continue
		}
		out = append(out, kv)
	}
	return out
}

func (s *Stacks) hasConfigFile() bool {
	if s.configDir == "" {
		return false
	}
	_, err := os.Stat(filepath.Join(s.configDir, "config.json"))
	return err == nil
}

func (s *Stacks) composeCommand(stackName string, args ...string) ([]string, error) {
	composePath, err := s.FindComposePath(stackName)
	if err != nil {
		return nil, err
	}
	cmd := []string{}
	// --config is only meaningful when a config.json exists; some compose
	// builds (e.g. OrbStack's plugin) reject the flag entirely otherwise.
	if s.hasConfigFile() {
		cmd = append(cmd, "--config", s.configDir)
	}
	cmd = append(cmd, "compose", "--file", composePath)
	if envPath := s.FindEnvPath(stackName); envPath != "" {
		cmd = append(cmd, "--env-file", envPath)
	}
	cmd = append(cmd, args...)
	return cmd, nil
}

// StreamCompose runs a docker compose command and yields its merged stdout+stderr
// as lines (with a heartbeat every 5s of silence), preceded by the echoed command.
func (s *Stacks) StreamCompose(ctx context.Context, stackName string, args ...string) (<-chan string, error) {
	cmdArgs, err := s.composeCommand(stackName, args...)
	if err != nil {
		return nil, err
	}
	full := append([]string{"docker"}, cmdArgs...)

	cmd := exec.CommandContext(ctx, "docker", cmdArgs...)
	cmd.Env = getDockerEnv()

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	out := make(chan string)
	go func() {
		defer close(out)
		out <- "$ " + strings.Join(full, " ")

		var wg sync.WaitGroup
		wg.Add(2)
		emit := func(r io.Reader) {
			defer wg.Done()
			sc := bufio.NewScanner(r)
			sc.Buffer(make([]byte, 64*1024), 1024*1024)
			for sc.Scan() {
				out <- sc.Text()
			}
		}
		go emit(stdout)
		go emit(stderr)
		done := make(chan struct{})
		go func() {
			wg.Wait()
			_ = cmd.Wait()
			close(done)
		}()

		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				select {
				case out <- heartbeat:
				case <-done:
					return
				}
			}
		}
	}()

	return out, nil
}

// RunCompose runs a compose command synchronously and drains all output.
func (s *Stacks) RunCompose(ctx context.Context, stackName string, args ...string) error {
	ch, err := s.StreamCompose(ctx, stackName, args...)
	if err != nil {
		return err
	}
	for range ch {
	}
	return nil
}

// UpServices runs `docker compose up -d <services>`, matching the redeploy
// path in the original app.
func (s *Stacks) UpServices(ctx context.Context, stackName string, services []string) error {
	composePath, err := s.FindComposePath(stackName)
	if err != nil {
		return err
	}
	cmdArgs := []string{}
	if s.hasConfigFile() {
		cmdArgs = append(cmdArgs, "--config", s.configDir)
	}
	cmdArgs = append(cmdArgs, "compose", "-f", composePath)
	if envPath := s.FindEnvPath(stackName); envPath != "" {
		cmdArgs = append(cmdArgs, "--env-file", envPath)
	}
	cmdArgs = append(cmdArgs, "up", "-d")
	cmdArgs = append(cmdArgs, services...)

	cmd := exec.CommandContext(ctx, "docker", cmdArgs...)
	cmd.Env = getDockerEnv()
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	return cmd.Run()
}

func (s *Stacks) GetRunningServices(ctx context.Context, stackName string) ([]string, error) {
	containers, err := s.client.ListRunningContainers(ctx, stackName)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var services []string
	for _, c := range containers {
		if svc, ok := c.Labels["com.docker.compose.service"]; ok && !seen[svc] {
			seen[svc] = true
			services = append(services, svc)
		}
	}
	sort.Strings(services)
	return services, nil
}

func (s *Stacks) GetStackStatus(ctx context.Context, stackName string) (StackStatus, error) {
	containers, err := s.client.ListContainers(ctx, true, stackName)
	if err != nil {
		return "", err
	}
	if len(containers) == 0 {
		return StackDown, nil
	}
	var restarting, running []container.Summary
	for _, c := range containers {
		switch containerStateToStatus(string(c.State), c.Status) {
		case StackRestarting:
			restarting = append(restarting, c)
		case StackRunning, StackHealthy, StackUnhealthy, StackStarting:
			running = append(running, c)
		}
	}
	if len(running) == 0 && len(restarting) == 0 {
		return StackStopped, nil
	}
	if len(running) == 0 {
		return StackRestarting, nil
	}
	if len(running)+len(restarting) < len(containers) || len(restarting) > 0 {
		return StackPartial, nil
	}
	for _, c := range running {
		if strings.Contains(c.Status, "(unhealthy)") {
			return StackUnhealthy, nil
		}
	}
	for _, c := range running {
		if strings.Contains(c.Status, "(health: starting)") {
			return StackStarting, nil
		}
	}
	allHealthy := true
	for _, c := range running {
		if !strings.Contains(c.Status, "(healthy)") {
			allHealthy = false
			break
		}
	}
	if allHealthy {
		return StackHealthy, nil
	}
	return StackRunning, nil
}

func (s *Stacks) ListStacksWithStatus(ctx context.Context) ([]Stack, error) {
	names, err := s.ListStacks(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Stack, 0, len(names))
	for _, name := range names {
		status, err := s.GetStackStatus(ctx, name)
		if err != nil {
			status = StackUnknown
		}
		out = append(out, Stack{Name: name, Status: status})
	}
	return out, nil
}

func (s *Stacks) GetStackContainers(ctx context.Context, stackName string) ([]ContainerInfo, error) {
	containers, err := s.client.ListContainers(ctx, true, stackName)
	if err != nil {
		return nil, err
	}
	out := make([]ContainerInfo, 0, len(containers))
	for _, c := range containers {
		out = append(out, mapContainer(c, s.serverHost, s.baseDomain))
	}

	// Merge in compose-file services that have no running container as "missing".
	known := map[string]bool{}
	for _, c := range containers {
		if svc, ok := c.Labels["com.docker.compose.service"]; ok {
			known[svc] = true
		}
	}
	composePath, err := s.FindComposePath(stackName)
	if err == nil {
		var compose struct {
			Services map[string]struct {
				Image  string            `yaml:"image"`
				Labels map[string]string `yaml:"labels"`
			} `yaml:"services"`
		}
		if data, err := os.ReadFile(composePath); err == nil {
			if err := yaml.Unmarshal(data, &compose); err == nil {
				names := make([]string, 0, len(compose.Services))
				for name := range compose.Services {
					names = append(names, name)
				}
				sort.Strings(names)
				for _, svcName := range names {
					svc := compose.Services[svcName]
					if known[svcName] {
						continue
					}
					missing := ContainerInfo{
						ID:          svcName,
						ServiceName: &svcName,
						Name:        "-",
						Image:       formatImageTag(svc.Image),
						Stack:       &stackName,
						Status:      string(StackMissing),
						Uptime:      "-",
						URLs:        getContainerURLs(svc.Labels, s.baseDomain),
					}
					if svc.Image == "" {
						missing.Image = "-"
					}
					out = append(out, missing)
				}
			}
		}
	}

	sort.Slice(out, func(i, j int) bool {
		li, lj := out[i].Name, out[j].Name
		if out[i].ServiceName != nil {
			li = *out[i].ServiceName
		}
		if out[j].ServiceName != nil {
			lj = *out[j].ServiceName
		}
		return li < lj
	})
	return out, nil
}

func (s *Stacks) RedeployAllRunning(ctx context.Context, skipList []string) []RedeployResult {
	names, err := s.ListStacks(ctx)
	if err != nil {
		return nil
	}
	results := make([]RedeployResult, 0, len(names))
	for _, name := range names {
		skip := false
		for _, s := range skipList {
			if s == name {
				skip = true
				break
			}
		}
		if skip {
			continue
		}
		res := RedeployResult{Name: name, Action: "skipped"}
		services, err := s.GetRunningServices(ctx, name)
		if err == nil && len(services) > 0 {
			if err := s.UpServices(ctx, name, services); err != nil {
				res.Action = "error"
				res.Error = err.Error()
			} else {
				res.Action = "redeployed"
				res.Services = services
			}
		}
		results = append(results, res)
	}
	return results
}

// RedeployStack is used by the webhook redeploy for a specific stack (matches
// TS getRunningServices + stackUpServices flow per stack).
func (s *Stacks) RedeployStack(ctx context.Context, name string, skipList []string) RedeployResult {
	for _, s := range skipList {
		if s == name {
			return RedeployResult{Name: name, Action: "skipped"}
		}
	}
	services, err := s.GetRunningServices(ctx, name)
	if err != nil {
		return RedeployResult{Name: name, Action: "error", Error: err.Error()}
	}
	if len(services) == 0 {
		return RedeployResult{Name: name, Action: "skipped"}
	}
	if err := s.UpServices(ctx, name, services); err != nil {
		return RedeployResult{Name: name, Action: "error", Error: err.Error()}
	}
	return RedeployResult{Name: name, Action: "redeployed", Services: services}
}
