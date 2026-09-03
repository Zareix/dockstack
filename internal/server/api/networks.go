package api

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/zareix/dockstack/internal/server/api/web"

	dockerapi "github.com/zareix/dockstack/internal/docker"
)

func (d *Deps) handleNetworksList(ctx context.Context, _ *struct{}) (*web.ListOutput[dockerapi.NetworkInfo], error) {
	networks, err := d.Docker.ListNetworksInfo(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to list networks")
	}
	return &web.ListOutput[dockerapi.NetworkInfo]{Body: networks}, nil
}

func (d *Deps) registerNetworks(api huma.API) {
	huma.Get(api, "/api/networks", d.handleNetworksList, d.SessionMW)
}
