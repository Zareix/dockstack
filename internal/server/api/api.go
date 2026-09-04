package api

import (
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/danielgtaylor/huma/v2/casing"
	"github.com/go-chi/chi/v5"
	dockerapi "github.com/zareix/dockstack/internal/docker"

	"github.com/zareix/dockstack/internal/server/api/auth"
	"github.com/zareix/dockstack/internal/server/api/ws"
)

var Version = "dev"

type Deps struct {
	*auth.Deps
	Docker *dockerapi.Client
	Stacks *dockerapi.Stacks
}

func publicAPIConfig() huma.Config {
	cfg := huma.DefaultConfig("Dockstack API", Version)
	cfg.OpenAPIPath = "/api/openapi"
	cfg.DocsPath = "/api/docs"
	cfg.SchemasPath = "/api/openapi-schemas"
	return cfg
}

func init() {
	huma.GenerateOperationID = func(method, path string, _ any) string {
		p := strings.TrimPrefix(strings.TrimSuffix(path, "/"), "/api")
		if strings.HasSuffix(path, "/") {
			p += "-slash"
		}
		return casing.Kebab(method + "-" + p)
	}
	huma.GenerateSummary = func(method, path string, _ any) string {
		return method + " " + path
	}
}

func Mount(router chi.Router, d *Deps) huma.API {
	api := humachi.New(router, publicAPIConfig())
	api.UseMiddleware(d.requestMiddleware)

	d.RegisterAuthRoutes(api, router)
	d.registerSettings(api)
	d.registerStacks(api, router)
	d.registerContainers(api)
	d.registerImages(api)
	d.registerVolumes(api)
	d.registerNetworks(api)
	ws.Mount(router, &ws.Deps{Store: d.Store, Docker: d.Docker, Stacks: d.Stacks})

	return api
}
