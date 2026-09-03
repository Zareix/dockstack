package api

import (
	"context"
	"regexp"

	"github.com/danielgtaylor/huma/v2"

	"github.com/zareix/dockstack/internal/server/api/web"

	dockerapi "github.com/zareix/dockstack/internal/docker"
)

var volumeNameRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`)

func (d *Deps) handleVolumesList(ctx context.Context, _ *struct{}) (*web.ListOutput[dockerapi.VolumeInfo], error) {
	volumes, err := d.Docker.ListVolumesInfo(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to list volumes")
	}
	return &web.ListOutput[dockerapi.VolumeInfo]{Body: volumes}, nil
}

func (d *Deps) handleVolumesPrune(ctx context.Context, _ *struct{}) (*dockerapi.PruneResult, error) {
	res, err := d.Docker.VolumePrune(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to prune volumes")
	}
	return &res, nil
}

type volumeNameInput struct {
	Name string `path:"name"`
}

func (d *Deps) handleVolumeRemove(ctx context.Context, in *volumeNameInput) (*web.OKResponse, error) {
	if !volumeNameRe.MatchString(in.Name) {
		return nil, huma.Error400BadRequest("invalid volume name")
	}
	if err := d.Docker.VolumeRemove(ctx, in.Name); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to remove volume")
	}
	return web.OK(), nil
}

func (d *Deps) registerVolumes(api huma.API) {
	huma.Get(api, "/api/volumes", d.handleVolumesList, d.SessionMW)
	huma.Post(api, "/api/volumes/prune", d.handleVolumesPrune, d.SessionMW)
	huma.Delete(api, "/api/volumes/{name}", d.handleVolumeRemove, d.SessionMW)
}
