package api

import (
	"context"
	"regexp"

	"github.com/danielgtaylor/huma/v2"

	"github.com/zareix/dockstack/internal/server/api/web"

	dockerapi "github.com/zareix/dockstack/internal/docker"
)

func (d *Deps) handleImagesList(ctx context.Context, _ *struct{}) (*web.ListOutput[dockerapi.ImageInfo], error) {
	images, err := d.Docker.ListImagesInfo(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to list images")
	}
	return &web.ListOutput[dockerapi.ImageInfo]{Body: images}, nil
}

func (d *Deps) handleImagesStale(ctx context.Context, _ *struct{}) (*web.MapOutput[dockerapi.StaleStatus], error) {
	return &web.MapOutput[dockerapi.StaleStatus]{Body: d.Docker.CheckImagesStale(ctx)}, nil
}

func (d *Deps) handleImagesPrune(ctx context.Context, _ *struct{}) (*web.DataOutput[dockerapi.PruneResult], error) {
	res, err := d.Docker.ImagePrune(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to prune images")
	}
	return &web.DataOutput[dockerapi.PruneResult]{Body: res}, nil
}

var imageIDRe = regexp.MustCompile(`^[a-zA-Z0-9._:/-]+$`)

func (d *Deps) handleImageRemove(ctx context.Context, in *idInput) (*web.OKResponse, error) {
	if !imageIDRe.MatchString(in.ID) {
		return nil, huma.Error400BadRequest("invalid image id")
	}
	if err := d.Docker.ImageRemove(ctx, in.ID); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to remove image")
	}
	return web.OK(), nil
}

func (d *Deps) registerImages(api huma.API) {
	huma.Get(api, "/api/images", d.handleImagesList, d.SessionMW)
	huma.Get(api, "/api/images/stale", d.handleImagesStale, d.SessionMW)
	huma.Post(api, "/api/images/prune", d.handleImagesPrune, d.SessionMW)
	huma.Delete(api, "/api/images/{id}", d.handleImageRemove, d.SessionMW)
}
