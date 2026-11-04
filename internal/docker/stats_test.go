package docker

import (
	"testing"

	"github.com/docker/docker/api/types/container"
)

func TestCPUPercent(t *testing.T) {
	cases := []struct {
		name string
		prev uint64
		cur  uint64
		sys  [2]uint64
		cpus uint32
		per  []uint64
		want float64
	}{
		{"two cpus", 100, 500, [2]uint64{1000, 3000}, 2, nil, 40},
		{"no delta", 100, 100, [2]uint64{1000, 2000}, 2, nil, 0},
		{"system delta zero", 0, 100, [2]uint64{1000, 1000}, 2, nil, 0},
		{"counter reset", 300, 100, [2]uint64{1000, 2000}, 2, nil, 0},
		{"online cpus fallback", 0, 250, [2]uint64{1000, 2000}, 0, []uint64{1, 2, 3, 4}, 100},
		{"no cpus", 0, 250, [2]uint64{1000, 2000}, 0, nil, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := container.StatsResponse{
				CPUStats:    container.CPUStats{CPUUsage: container.CPUUsage{TotalUsage: c.cur, PercpuUsage: c.per}, SystemUsage: c.sys[1], OnlineCPUs: c.cpus},
				PreCPUStats: container.CPUStats{CPUUsage: container.CPUUsage{TotalUsage: c.prev}, SystemUsage: c.sys[0]},
			}
			if got := cpuPercent(s); got != c.want {
				t.Fatalf("cpuPercent() = %v, want %v", got, c.want)
			}
		})
	}
}

func TestMemoryUsed(t *testing.T) {
	cases := []struct {
		name  string
		usage uint64
		stats map[string]uint64
		want  uint64
	}{
		{"cgroup v1", 1000, map[string]uint64{"total_inactive_file": 100}, 900},
		{"cgroup v2", 1000, map[string]uint64{"inactive_file": 200}, 800},
		{"no cache stat", 1000, map[string]uint64{"anon": 400}, 1000},
		{"cache above usage", 1000, map[string]uint64{"total_inactive_file": 2000, "inactive_file": 100}, 900},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			m := container.MemoryStats{Usage: c.usage, Stats: c.stats}
			if got := memoryUsed(m); got != c.want {
				t.Fatalf("memoryUsed() = %v, want %v", got, c.want)
			}
		})
	}
}

func TestMemoryLimit(t *testing.T) {
	const hostMem = uint64(16) << 30
	cases := []struct {
		name  string
		limit uint64
		want  uint64
	}{
		{"no limit", 0, 0},
		{"unlimited sentinel", maxReasonableMemSize + 1, 0},
		{"host total is not a container limit", hostMem, 0},
		{"real container limit", 512 << 20, 512 << 20},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := memoryLimit(container.MemoryStats{Limit: c.limit}, hostMem); got != c.want {
				t.Fatalf("memoryLimit() = %v, want %v", got, c.want)
			}
		})
	}
}

func TestNetworkAndBlockBytes(t *testing.T) {
	networks := map[string]container.NetworkStats{
		"eth0": {RxBytes: 10, TxBytes: 20},
		"eth1": {RxBytes: 30, TxBytes: 40},
	}
	if got := networkBytes(networks, true); got != 40 {
		t.Fatalf("network rx = %v, want 40", got)
	}
	if got := networkBytes(networks, false); got != 60 {
		t.Fatalf("network tx = %v, want 60", got)
	}

	blkio := container.BlkioStats{IoServiceBytesRecursive: []container.BlkioStatEntry{
		{Op: "Read", Value: 1},
		{Op: "read", Value: 2},
		{Op: "Write", Value: 4},
		{Op: "Sync", Value: 8},
	}}
	if got := blockBytes(blkio, "read"); got != 3 {
		t.Fatalf("block read = %v, want 3", got)
	}
	if got := blockBytes(blkio, "write"); got != 4 {
		t.Fatalf("block write = %v, want 4", got)
	}
}
