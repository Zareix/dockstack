package docker

import (
	"context"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
)

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
