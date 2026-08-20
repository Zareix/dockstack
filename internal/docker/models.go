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

type VolumeInfo struct {
	Name    string `json:"name"`
	Driver  string `json:"driver"`
	Created string `json:"created"`
	Size    int64  `json:"size"`
	InUse   bool   `json:"inUse"`
	Status  string `json:"status"`
}

type NetworkInfo struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Driver string `json:"driver"`
	Scope  string `json:"scope"`
	Status string `json:"status"`
}

type LogEntry struct {
	ContainerName string `json:"containerName"`
	Message       string `json:"message"`
	Stream        string `json:"stream"`
	Timestamp     string `json:"timestamp"`
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
