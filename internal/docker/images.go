package docker

import (
	"context"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
)

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

	before, err := c.api.ImageList(ctx, image.ListOptions{})
	if err != nil {
		return PruneResult{}, err
	}
	report, err := c.api.ImagesPrune(ctx, f)
	if err != nil {
		return PruneResult{}, err
	}
	after, err := c.api.ImageList(ctx, image.ListOptions{})
	if err != nil {
		return PruneResult{}, err
	}
	afterIDs := make(map[string]bool, len(after))
	for _, img := range after {
		afterIDs[img.ID] = true
	}
	var reclaimed int64
	for _, img := range before {
		if !afterIDs[img.ID] {
			reclaimed += img.Size
		}
	}

	pruned := make([]string, 0, len(report.ImagesDeleted))
	for _, d := range report.ImagesDeleted {
		if d.Deleted != "" {
			pruned = append(pruned, d.Deleted)
		} else if d.Untagged != "" {
			pruned = append(pruned, d.Untagged)
		}
	}
	if report.SpaceReclaimed > 0 {
		reclaimed = int64(report.SpaceReclaimed)
	}
	return PruneResult{Deleted: pruned, SpaceReclaimed: reclaimed}, nil
}
