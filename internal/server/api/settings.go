package api

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/zareix/dockstack/internal/server/api/web"
)

type settingsResponse struct {
	Body struct {
		AppTitle     string     `json:"appTitle"`
		InstanceName string     `json:"instanceName"`
		Instances    []instance `json:"instances"`
	}
}

type instance struct {
	Title     string `json:"title"`
	URL       string `json:"url"`
	IsCurrent bool   `json:"isCurrent"`
}

func (d *Deps) handleSettings(ctx context.Context, _ *struct{}) (*settingsResponse, error) {
	instances := make([]instance, 0, len(d.Cfg.OtherInstanceURLs)+1)
	for _, inst := range d.Cfg.OtherInstanceURLs {
		instances = append(instances, instance{Title: inst.Title, URL: inst.URL})
	}
	currentURL := d.Cfg.AppURL
	if currentURL == "" {
		currentURL = "/"
	}
	instances = append(instances, instance{
		Title:     d.Cfg.AppTitle,
		URL:       currentURL,
		IsCurrent: true,
	})
	resp := &settingsResponse{}
	resp.Body.AppTitle = d.Cfg.AppTitle
	resp.Body.InstanceName = d.Cfg.InstanceName
	resp.Body.Instances = instances
	return resp, nil
}

func (d *Deps) handleProviders(ctx context.Context, _ *struct{}) (*web.ListOutput[string], error) {
	providers := []string{}
	if d.Cfg.OAuth != nil {
		providers = append(providers, d.Cfg.OAuth.ProviderID)
	}
	return &web.ListOutput[string]{Body: providers}, nil
}

func (d *Deps) registerSettings(api huma.API) {
	huma.Get(api, "/api/health", d.handleHealth)
	huma.Get(api, "/api/settings", d.handleSettings)
	huma.Get(api, "/api/auth/providers", d.handleProviders)
}

func (d *Deps) handleHealth(ctx context.Context, _ *struct{}) (*web.OKResponse, error) {
	return web.OK(), nil
}
