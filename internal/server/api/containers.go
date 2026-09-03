package api

import (
	"context"
	"regexp"

	"github.com/danielgtaylor/huma/v2"

	"github.com/zareix/dockstack/internal/server/api/web"

	dockerapi "github.com/zareix/dockstack/internal/docker"
)

func (d *Deps) handleContainersList(ctx context.Context, _ *struct{}) (*web.ListOutput[dockerapi.ContainerInfo], error) {
	r := web.RequestFrom(ctx)
	containers, err := d.Docker.ListAllContainers(ctx, d.Cfg.ServerHost, d.Cfg.AutodetectURLBaseDomain)
	if err != nil {
		web.LogError(r, err)
		return nil, huma.Error500InternalServerError("failed to list containers")
	}
	return &web.ListOutput[dockerapi.ContainerInfo]{Body: containers}, nil
}

func (d *Deps) handleContainersPrune(ctx context.Context, _ *struct{}) (*web.DataOutput[dockerapi.PruneResult], error) {
	res, err := d.Docker.ContainerPrune(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to prune containers")
	}
	return &web.DataOutput[dockerapi.PruneResult]{Body: res}, nil
}

var containerIDRe = regexp.MustCompile(`^[a-f0-9]{1,64}$`)

type idInput struct {
	ID string `path:"id"`
}

func (d *Deps) containerAction(action string) func(ctx context.Context, in *idInput) (*web.OKResponse, error) {
	return func(ctx context.Context, in *idInput) (*web.OKResponse, error) {
		if !containerIDRe.MatchString(in.ID) {
			return nil, huma.Error400BadRequest("invalid container id")
		}
		var err error
		switch action {
		case "start":
			err = d.Docker.ContainerStart(ctx, in.ID)
		case "stop":
			err = d.Docker.ContainerStop(ctx, in.ID)
		case "restart":
			err = d.Docker.ContainerRestart(ctx, in.ID)
		}
		if err != nil {
			web.LogError(web.RequestFrom(ctx), err)
			return nil, huma.Error500InternalServerError("container action failed")
		}
		return web.OK(), nil
	}
}

func (d *Deps) handleContainerRemove(ctx context.Context, in *idInput) (*web.OKResponse, error) {
	if !containerIDRe.MatchString(in.ID) {
		return nil, huma.Error400BadRequest("invalid container id")
	}
	if err := d.Docker.ContainerRemove(ctx, in.ID); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to remove container")
	}
	return web.OK(), nil
}

func (d *Deps) registerContainers(api huma.API) {
	huma.Get(api, "/api/containers", d.handleContainersList, d.SessionMW)
	huma.Post(api, "/api/containers/prune", d.handleContainersPrune, d.SessionMW)
	huma.Post(api, "/api/containers/{id}/start", d.containerAction("start"), d.SessionMW)
	huma.Post(api, "/api/containers/{id}/stop", d.containerAction("stop"), d.SessionMW)
	huma.Post(api, "/api/containers/{id}/restart", d.containerAction("restart"), d.SessionMW)
	huma.Delete(api, "/api/containers/{id}", d.handleContainerRemove, d.SessionMW)
}
