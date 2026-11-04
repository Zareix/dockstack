package docker

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
)

const (
	statsConcurrency     = 8
	statsTimeout         = 3 * time.Second
	maxReasonableMemSize = uint64(1) << 62
)

func (c *Client) ListRunningContainerStats(ctx context.Context) ([]ContainerStats, error) {
	containers, err := c.ListRunningContainers(ctx, "")
	if err != nil {
		return nil, err
	}

	var hostMem uint64
	if info, err := c.api.Info(ctx); err == nil && info.MemTotal > 0 {
		hostMem = uint64(info.MemTotal)
	}

	var (
		mu  sync.Mutex
		wg  sync.WaitGroup
		sem = make(chan struct{}, statsConcurrency)
		out = make([]ContainerStats, 0, len(containers))
	)
	for _, ct := range containers {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-ctx.Done():
				return
			}
			stats, err := c.containerStats(ctx, id, hostMem)
			if err != nil {
				return
			}
			mu.Lock()
			out = append(out, stats)
			mu.Unlock()
		}(ct.ID)
	}
	wg.Wait()

	sort.Slice(out, func(i, j int) bool { return out[i].ContainerID < out[j].ContainerID })
	return out, nil
}

func (c *Client) containerStats(ctx context.Context, id string, hostMem uint64) (ContainerStats, error) {
	statsCtx, cancel := context.WithTimeout(ctx, statsTimeout)
	defer cancel()

	reader, err := c.api.ContainerStatsOneShot(statsCtx, id)
	if err != nil {
		return ContainerStats{}, err
	}
	defer func() { _ = reader.Body.Close() }()

	var raw container.StatsResponse
	if err := json.NewDecoder(reader.Body).Decode(&raw); err != nil {
		return ContainerStats{}, err
	}

	stats := ContainerStats{
		ContainerID: truncateID(id),
		CPUPercent:  cpuPercent(raw),
		MemoryUsed:  memoryUsed(raw.MemoryStats),
		MemoryLimit: memoryLimit(raw.MemoryStats, hostMem),
		NetworkRx:   networkBytes(raw.Networks, true),
		NetworkTx:   networkBytes(raw.Networks, false),
		BlockRead:   blockBytes(raw.BlkioStats, "read"),
		BlockWrite:  blockBytes(raw.BlkioStats, "write"),
		PIDs:        raw.PidsStats.Current,
	}
	if stats.MemoryLimit > 0 {
		stats.MemoryPercent = float64(stats.MemoryUsed) / float64(stats.MemoryLimit) * 100
	}
	return stats, nil
}

func cpuPercent(s container.StatsResponse) float64 {
	cpuDelta := float64(s.CPUStats.CPUUsage.TotalUsage) - float64(s.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(s.CPUStats.SystemUsage) - float64(s.PreCPUStats.SystemUsage)
	if cpuDelta <= 0 || systemDelta <= 0 {
		return 0
	}
	onlineCPUs := float64(s.CPUStats.OnlineCPUs)
	if onlineCPUs == 0 {
		onlineCPUs = float64(len(s.CPUStats.CPUUsage.PercpuUsage))
	}
	if onlineCPUs == 0 {
		return 0
	}
	return cpuDelta / systemDelta * onlineCPUs * 100
}

func memoryUsed(m container.MemoryStats) uint64 {
	if v, ok := m.Stats["total_inactive_file"]; ok && v < m.Usage {
		return m.Usage - v
	}
	if v, ok := m.Stats["inactive_file"]; ok && v < m.Usage {
		return m.Usage - v
	}
	return m.Usage
}

func memoryLimit(m container.MemoryStats, hostMem uint64) uint64 {
	if m.Limit == 0 || m.Limit > maxReasonableMemSize {
		return 0
	}
	// cgroup v1 reports the host total as the limit when the container has none.
	if hostMem > 0 && m.Limit >= hostMem {
		return 0
	}
	return m.Limit
}

func networkBytes(networks map[string]container.NetworkStats, rx bool) uint64 {
	var total uint64
	for _, n := range networks {
		if rx {
			total += n.RxBytes
		} else {
			total += n.TxBytes
		}
	}
	return total
}

func blockBytes(blkio container.BlkioStats, op string) uint64 {
	var total uint64
	for _, e := range blkio.IoServiceBytesRecursive {
		if strings.EqualFold(e.Op, op) {
			total += e.Value
		}
	}
	return total
}
