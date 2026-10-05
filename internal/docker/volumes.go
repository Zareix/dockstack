package docker

import (
	"context"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/volume"
)

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
