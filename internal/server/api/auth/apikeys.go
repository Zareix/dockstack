package auth

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/zareix/dockstack/internal/server/api/web"

	coreauth "github.com/zareix/dockstack/internal/auth"
)

type apiKeyResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt int64  `json:"createdAt"`
	ExpiresAt *int64 `json:"expiresAt"`
	Enabled   bool   `json:"enabled"`
}

func toAPIKeyResponse(k coreauth.APIKey) apiKeyResponse {
	return apiKeyResponse{
		ID:        k.ID,
		Name:      k.Name,
		CreatedAt: k.CreatedAt,
		ExpiresAt: k.ExpiresAt,
		Enabled:   k.Enabled,
	}
}

type idInput struct {
	ID string `path:"id"`
}

type createAPIKeyRequest struct {
	Name      string `json:"name,omitempty"`
	ExpiresAt *int64 `json:"expiresAt,omitempty"`
}

type createAPIKeyOutput struct {
	Body struct {
		Key    string         `json:"key"`
		APIKey apiKeyResponse `json:"apiKey"`
	}
}

func (d *Deps) handleCreateAPIKey(ctx context.Context, in *struct{ Body createAPIKeyRequest }) (*createAPIKeyOutput, error) {
	user := web.UserFrom(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	key, err := coreauth.GenerateAPIKey()
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to generate key")
	}
	created, err := d.Store.CreateAPIKey(ctx, coreauth.NewAPIKey{
		UserID:    user.ID,
		Name:      in.Body.Name,
		KeyHash:   coreauth.HashToken(key),
		ExpiresAt: in.Body.ExpiresAt,
	})
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to create API key")
	}
	out := &createAPIKeyOutput{}
	out.Body.Key = key
	out.Body.APIKey = toAPIKeyResponse(*created)
	return out, nil
}

func (d *Deps) handleListAPIKeys(ctx context.Context, _ *struct{}) (*web.ListOutput[apiKeyResponse], error) {
	user := web.UserFrom(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	keys, err := d.Store.ListAPIKeys(ctx, user.ID)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to list API keys")
	}
	out := make([]apiKeyResponse, 0, len(keys))
	for _, k := range keys {
		out = append(out, toAPIKeyResponse(k))
	}
	return &web.ListOutput[apiKeyResponse]{Body: out}, nil
}

func (d *Deps) handleDeleteAPIKey(ctx context.Context, in *idInput) (*web.OKResponse, error) {
	user := web.UserFrom(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	if err := d.Store.DeleteAPIKey(ctx, user.ID, in.ID); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to delete API key")
	}
	return web.OK(), nil
}

func (d *Deps) registerAPIKeys(api huma.API) {
	huma.Post(api, "/api/auth/api-keys", d.handleCreateAPIKey, d.SessionMW)
	huma.Get(api, "/api/auth/api-keys", d.handleListAPIKeys, d.SessionMW)
	huma.Delete(api, "/api/auth/api-keys/{id}", d.handleDeleteAPIKey, d.SessionMW)
}
