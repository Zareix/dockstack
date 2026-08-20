package docker

import (
	"context"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
)

func (c *Client) ListContainers(ctx context.Context, all bool, project string) ([]container.Summary, error) {
	opts := container.ListOptions{All: all}
	if project != "" {
		opts.Filters = filters.NewArgs()
		opts.Filters.Add("label", "com.docker.compose.project="+project)
	}
	return c.api.ContainerList(ctx, opts)
}

func (c *Client) ListRunningContainers(ctx context.Context, project string) ([]container.Summary, error) {
	opts := container.ListOptions{}
	if project != "" {
		opts.Filters = filters.NewArgs()
		opts.Filters.Add("label", "com.docker.compose.project="+project)
	}
	opts.Filters.Add("status", "running")
	return c.api.ContainerList(ctx, opts)
}

func containerStateToStatus(state, status string) StackStatus {
	switch state {
	case "running":
		if strings.Contains(status, "(healthy)") {
			return StackHealthy
		}
		if strings.Contains(status, "(unhealthy)") {
			return StackUnhealthy
		}
		if strings.Contains(status, "(health: starting)") {
			return StackStarting
		}
		return StackRunning
	case "restarting":
		return StackRestarting
	case "exited", "paused":
		return StackStopped
	case "dead", "created", "removing":
		return StackDown
	default:
		return StackUnknown
	}
}

var traefikRuleRe = regexp.MustCompile(`^traefik\.http\.routers\.(.*)\.rule$`)
var hostRuleRe = regexp.MustCompile("^Host\\(`([^`]*)`\\)")

func getContainerURLs(labels map[string]string, baseDomain string) []string {
	if alias, ok := labels["proxy.aliases"]; ok && baseDomain != "" {
		parts := strings.Split(alias, ",")
		urls := make([]string, 0, len(parts))
		for _, a := range parts {
			a = strings.TrimSpace(a)
			if a == "" {
				continue
			}
			if strings.Contains(a, ".") {
				urls = append(urls, "https://"+a)
			} else {
				urls = append(urls, "https://"+a+"."+baseDomain)
			}
		}
		return urls
	}

	for label, value := range labels {
		if traefikRuleRe.MatchString(label) {
			var urls []string
			for _, rule := range strings.Split(value, ",") {
				rule = strings.TrimSpace(rule)
				if !strings.HasPrefix(rule, "Host(") {
					continue
				}
				m := hostRuleRe.FindStringSubmatch(rule)
				if m != nil {
					urls = append(urls, "https://"+m[1])
				}
			}
			return urls
		}
	}
	return nil
}

func formatImageTag(tag string) string {
	if strings.HasPrefix(tag, "sha256:") {
		id := strings.TrimPrefix(tag, "sha256:")
		if len(id) > 12 {
			id = id[:12]
		}
		return id
	}
	return tag
}

func mapContainer(c container.Summary, serverHost, baseDomain string) ContainerInfo {
	info := ContainerInfo{
		ID:     truncateID(c.ID),
		Image:  formatImageTag(c.Image),
		Status: string(containerStateToStatus(string(c.State), c.Status)),
		Uptime: strings.TrimSpace(regexp.MustCompile(`\s*\(.*?\)`).ReplaceAllString(c.Status, "")),
		URLs:   getContainerURLs(c.Labels, baseDomain),
	}
	if svc, ok := c.Labels["com.docker.compose.service"]; ok {
		info.ServiceName = &svc
	}
	if project, ok := c.Labels["com.docker.compose.project"]; ok {
		info.Stack = &project
	}
	if len(c.Names) > 0 {
		info.Name = strings.TrimPrefix(c.Names[0], "/")
	} else {
		info.Name = truncateID(c.ID)
	}

	seen := map[string]bool{}
	for _, p := range c.Ports {
		if p.PublicPort == 0 {
			continue
		}
		key := strconv.Itoa(int(p.PublicPort)) + "/" + string(p.Type)
		if seen[key] {
			continue
		}
		seen[key] = true
		info.Ports = append(info.Ports, Port{
			HostPort:      int(p.PublicPort),
			ContainerPort: int(p.PrivatePort),
			Protocol:      string(p.Type),
			HostName:      serverHost,
		})
	}
	return info
}

func truncateID(id string) string {
	if len(id) > 12 {
		return id[:12]
	}
	return id
}

func (c *Client) ListAllContainers(ctx context.Context, serverHost, baseDomain string) ([]ContainerInfo, error) {
	containers, err := c.ListContainers(ctx, true, "")
	if err != nil {
		return nil, err
	}
	out := make([]ContainerInfo, 0, len(containers))
	for _, ct := range containers {
		out = append(out, mapContainer(ct, serverHost, baseDomain))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func (c *Client) ContainerStart(ctx context.Context, id string) error {
	return c.api.ContainerStart(ctx, id, container.StartOptions{})
}

func (c *Client) ContainerStop(ctx context.Context, id string) error {
	return c.api.ContainerStop(ctx, id, container.StopOptions{})
}

func (c *Client) ContainerRestart(ctx context.Context, id string) error {
	return c.api.ContainerRestart(ctx, id, container.StopOptions{})
}

func (c *Client) ContainerRemove(ctx context.Context, id string) error {
	return c.api.ContainerRemove(ctx, id, container.RemoveOptions{Force: true})
}

func (c *Client) ContainerPrune(ctx context.Context) (PruneResult, error) {
	report, err := c.api.ContainersPrune(ctx, filters.NewArgs())
	if err != nil {
		return PruneResult{}, err
	}
	return PruneResult{Deleted: report.ContainersDeleted, SpaceReclaimed: int64(report.SpaceReclaimed)}, nil
}

func (c *Client) ListImages(ctx context.Context) ([]image.Summary, error) {
	return c.api.ImageList(ctx, image.ListOptions{})
}

func (c *Client) ImageRemove(ctx context.Context, id string) error {
	_, err := c.api.ImageRemove(ctx, id, image.RemoveOptions{Force: true})
	return err
}

func (c *Client) ImagePrune(ctx context.Context) (PruneResult, error) {
	f := filters.NewArgs()
	f.Add("dangling", "false")
	report, err := c.api.ImagesPrune(ctx, f)
	if err != nil {
		return PruneResult{}, err
	}
	pruned := make([]string, 0, len(report.ImagesDeleted))
	for _, d := range report.ImagesDeleted {
		if d.Deleted != "" {
			pruned = append(pruned, d.Deleted)
		} else if d.Untagged != "" {
			pruned = append(pruned, d.Untagged)
		}
	}
	return PruneResult{Deleted: pruned, SpaceReclaimed: int64(report.SpaceReclaimed)}, nil
}

func (c *Client) ListVolumes(ctx context.Context) ([]*volume.Volume, error) {
	res, err := c.api.VolumeList(ctx, volume.ListOptions{})
	if err != nil {
		return nil, err
	}
	return res.Volumes, nil
}

func (c *Client) VolumeRemove(ctx context.Context, name string) error {
	return c.api.VolumeRemove(ctx, name, true)
}

func (c *Client) VolumePrune(ctx context.Context) (PruneResult, error) {
	f := filters.NewArgs()
	f.Add("all", "true")
	report, err := c.api.VolumesPrune(ctx, f)
	if err != nil {
		return PruneResult{}, err
	}
	return PruneResult{Deleted: report.VolumesDeleted, SpaceReclaimed: int64(report.SpaceReclaimed)}, nil
}

func (c *Client) ListNetworks(ctx context.Context) ([]network.Summary, error) {
	return c.api.NetworkList(ctx, network.ListOptions{})
}

func (c *Client) NetworkPrune(ctx context.Context) (PruneResult, error) {
	report, err := c.api.NetworksPrune(ctx, filters.NewArgs())
	if err != nil {
		return PruneResult{}, err
	}
	return PruneResult{Deleted: report.NetworksDeleted}, nil
}
