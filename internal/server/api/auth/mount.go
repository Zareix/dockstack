package auth

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"
)

func (d *Deps) RegisterAuthRoutes(api huma.API, router chi.Router) {
	d.registerAuth(api)
	d.registerAPIKeys(api)
	d.registerPasskeys(api)
	d.registerOAuth(router)
}
