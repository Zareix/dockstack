package docker

type StackStatus string

const (
	StackRunning    StackStatus = "running"
	StackHealthy    StackStatus = "healthy"
	StackUnhealthy  StackStatus = "unhealthy"
	StackStarting   StackStatus = "starting"
	StackRestarting StackStatus = "restarting"
	StackPartial    StackStatus = "partial"
	StackStopped    StackStatus = "stopped"
	StackDown       StackStatus = "down"
	StackUnknown    StackStatus = "unknown"
	StackMissing    StackStatus = "missing"
)

type Port struct {
	HostPort      int    `json:"hostPort"`
	ContainerPort int    `json:"containerPort"`
	Protocol      string `json:"protocol"`
	HostName      string `json:"hostName"`
}

type ContainerInfo struct {
	ID          string   `json:"id"`
	ServiceName *string  `json:"serviceName"`
	Name        string   `json:"name"`
	Image       string   `json:"image"`
	Stack       *string  `json:"stack"`
	Status      string   `json:"status"`
	Uptime      string   `json:"uptime"`
	Ports       []Port   `json:"ports"`
	URLs        []string `json:"urls"`
}

type Stack struct {
	Name   string      `json:"name"`
	Status StackStatus `json:"status"`
}

type ImageInfo struct {
	ID          string   `json:"id"`
	Tags        []string `json:"tags"`
	RepoDigests []string `json:"repoDigests"`
	Size        int64    `json:"size"`
	Created     int64    `json:"created"`
}

type StaleStatus string

const (
	StaleOutdated StaleStatus = "outdated"
	StaleUpToDate StaleStatus = "up-to-date"
	StaleUnknown  StaleStatus = "unknown"
)

type DriftStatus string

const (
	DriftInSync   DriftStatus = "in-sync"
	DriftOutdated DriftStatus = "outdated"
	DriftUnknown  DriftStatus = "unknown"
)

type VolumeStatus string

const (
	VolumeInUse VolumeStatus = "in-use"
	VolumeFree  VolumeStatus = "unused"
)

type VolumeInfo struct {
	Name    string       `json:"name"`
	Driver  string       `json:"driver"`
	Created string       `json:"created"`
	Size    int64        `json:"size"`
	InUse   bool         `json:"inUse"`
	Status  VolumeStatus `json:"status"`
}

type NetworkStatus string

const (
	NetworkSystem NetworkStatus = "system"
	NetworkInUse  NetworkStatus = "in-use"
	NetworkUnused NetworkStatus = "unused"
)

type NetworkInfo struct {
	ID     string        `json:"id"`
	Name   string        `json:"name"`
	Driver string        `json:"driver"`
	Scope  string        `json:"scope"`
	Status NetworkStatus `json:"status"`
}

type ContainerStats struct {
	ContainerID   string  `json:"containerId"`
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryUsed    uint64  `json:"memoryUsed"`
	MemoryLimit   uint64  `json:"memoryLimit"`
	MemoryPercent float64 `json:"memoryPercent"`
	NetworkRx     uint64  `json:"networkRx"`
	NetworkTx     uint64  `json:"networkTx"`
	BlockRead     uint64  `json:"blockRead"`
	BlockWrite    uint64  `json:"blockWrite"`
	PIDs          uint64  `json:"pids"`
}

type LogEntry struct {
	ContainerName string `json:"containerName"`
	Message       string `json:"message"`
	Stream        string `json:"stream"`
	Timestamp     string `json:"timestamp"`
}

type ComposeValidation struct {
	Valid            bool     `json:"valid"`
	Errors           []string `json:"errors"`
	Warnings         []string `json:"warnings"`
	ComposeAvailable bool     `json:"composeAvailable"`
}

type RedeployResult struct {
	Name     string   `json:"name"`
	Action   string   `json:"action"`
	Services []string `json:"services,omitempty"`
	Error    string   `json:"error,omitempty"`
}

type PruneResult struct {
	Deleted        []string `json:"deleted"`
	SpaceReclaimed int64    `json:"spaceReclaimed"`
}

type SystemPruneResult struct {
	Containers          PruneResult `json:"containers"`
	Images              PruneResult `json:"images"`
	Networks            PruneResult `json:"networks"`
	Volumes             PruneResult `json:"volumes"`
	TotalSpaceReclaimed int64       `json:"totalSpaceReclaimed"`
}

type StackStatusInfo struct {
	Status StackStatus `json:"status"`
}
