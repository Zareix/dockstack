package docker

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/docker/docker/api/types/container"
)

func (s *Stacks) containerPortWarnings(ctx context.Context, stackName, resolved string) []string {
	if s.client == nil {
		return nil
	}
	cfg, ok := parseResolvedCompose(resolved)
	if !ok {
		return nil
	}
	containers, err := s.client.ListRunningContainers(ctx, "")
	if err != nil {
		return nil
	}
	return containerPortWarnings(stackName, composePortBindings(cfg), containers)
}

func containerPortWarnings(stackName string, bindings []hostBinding, containers []container.Summary) []string {
	if len(bindings) == 0 {
		return nil
	}
	sort.SliceStable(containers, func(i, j int) bool {
		return containerName(containers[i]) < containerName(containers[j])
	})
	warnings := []string{}
	seen := map[string]struct{}{}
	for _, ct := range containers {
		if ct.Labels["com.docker.compose.project"] == stackName {
			continue
		}
		name := containerName(ct)
		for _, port := range ct.Ports {
			if port.PublicPort == 0 {
				continue
			}
			protocol := string(port.Type)
			if protocol == "" {
				protocol = "tcp"
			}
			hostIP := normalizeHostIP(port.IP)
			for _, binding := range bindings {
				if binding.protocol != protocol ||
					!portRangesOverlap(int(port.PublicPort), int(port.PublicPort), binding.start, binding.end) ||
					!hostIPsConflict(hostIP, binding.hostIP) {
					continue
				}
				key := fmt.Sprintf("%s/%d/%s/%s", protocol, port.PublicPort, ct.ID, binding.service)
				if _, ok := seen[key]; ok {
					continue
				}
				seen[key] = struct{}{}
				warnings = append(warnings, containerPortWarning(binding.service, name, protocol, int(port.PublicPort), ct.Labels))
			}
		}
	}
	return warnings
}

func containerName(ct container.Summary) string {
	if len(ct.Names) > 0 {
		return strings.TrimPrefix(ct.Names[0], "/")
	}
	if len(ct.ID) > 12 {
		return ct.ID[:12]
	}
	return ct.ID
}

func containerPortWarning(service, name, protocol string, port int, labels map[string]string) string {
	target := fmt.Sprintf("container %q", name)
	if stack := labels["com.docker.compose.project"]; stack != "" {
		target = fmt.Sprintf("container %q (stack %q)", name, stack)
	}
	return fmt.Sprintf("host port %d/%s for service %q is already used by %s", port, protocol, service, target)
}
