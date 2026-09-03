package docker

import "github.com/danielgtaylor/huma/v2"

func enumSchema(values ...any) *huma.Schema {
	return &huma.Schema{Type: "string", Enum: values}
}

func (StackStatus) Schema(_ huma.Registry) *huma.Schema {
	return enumSchema(
		StackRunning,
		StackHealthy,
		StackUnhealthy,
		StackStarting,
		StackRestarting,
		StackPartial,
		StackStopped,
		StackDown,
		StackUnknown,
		StackMissing,
	)
}

func (StaleStatus) Schema(_ huma.Registry) *huma.Schema {
	return enumSchema(StaleOutdated, StaleUpToDate, StaleUnknown)
}

func (VolumeStatus) Schema(_ huma.Registry) *huma.Schema {
	return enumSchema(VolumeInUse, VolumeFree)
}

func (NetworkStatus) Schema(_ huma.Registry) *huma.Schema {
	return enumSchema(NetworkSystem, NetworkInUse, NetworkUnused)
}
