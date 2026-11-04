package api

import (
	"context"
	"regexp"

	"github.com/danielgtaylor/huma/v2"

	"github.com/zareix/dockstack/internal/server/api/web"

	dockerapi "github.com/zareix/dockstack/internal/docker"
)

var networkNameRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`)

func (d *Deps) handleNetworksList(ctx context.Context, _ *struct{}) (*web.ListOutput[dockerapi.NetworkInfo], error) {
	networks, err := d.Docker.ListNetworksInfo(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to list networks")
	}
	return &web.ListOutput[dockerapi.NetworkInfo]{Body: networks}, nil
}

func (d *Deps) handleNetworksPrune(ctx context.Context, _ *struct{}) (*web.DataOutput[dockerapi.PruneResult], error) {
	res, err := d.Docker.NetworkPrune(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to prune networks")
	}
	return &web.DataOutput[dockerapi.PruneResult]{Body: res}, nil
}

type networkNameInput struct {
	Name string `path:"name"`
}

func (d *Deps) handleNetworkRemove(ctx context.Context, in *networkNameInput) (*web.OKResponse, error) {
	if !networkNameRe.MatchString(in.Name) {
		return nil, huma.Error400BadRequest("invalid network name")
	}
	networks, err := d.Docker.ListNetworksInfo(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to list networks")
	}
	var found *dockerapi.NetworkInfo
	for i := range networks {
		if networks[i].Name == in.Name {
			found = &networks[i]
			break
		}
	}
	if found == nil {
		return nil, huma.Error404NotFound("network not found")
	}
	switch found.Status {
	case dockerapi.NetworkSystem:
		return nil, huma.Error409Conflict("cannot remove a default system network")
	case dockerapi.NetworkInUse:
		return nil, huma.Error409Conflict("network is in use by one or more containers")
	}
	if err := d.Docker.NetworkRemove(ctx, in.Name); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to remove network")
	}
	return web.OK(), nil
}

func (d *Deps) registerNetworks(api huma.API) {
	huma.Get(api, "/api/networks", d.handleNetworksList, d.AuthMW)
	huma.Post(api, "/api/networks/prune", d.handleNetworksPrune, d.AuthMW)
	huma.Delete(api, "/api/networks/{name}", d.handleNetworkRemove, d.AuthMW)
}
