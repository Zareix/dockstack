package auth

import (
	"context"
	"encoding/json"

	"github.com/danielgtaylor/huma/v2"

	"github.com/zareix/dockstack/internal/server/api/web"

	coreauth "github.com/zareix/dockstack/internal/auth"
)

const passkeyChallengeCookie = "dockstack_passkey_challenge"

func (d *Deps) setPasskeyChallengeCookieValue(id string) string {
	return d.setCookieString(passkeyChallengeCookie, id, 0)
}

func (d *Deps) clearPasskeyChallengeCookieValue() string {
	return d.setCookieString(passkeyChallengeCookie, "", -1)
}

func (d *Deps) challengeCookie(ctx context.Context) (string, error) {
	r := web.RequestFrom(ctx)
	cookie, err := r.Cookie(passkeyChallengeCookie)
	if err != nil || cookie.Value == "" {
		return "", huma.Error400BadRequest("missing challenge")
	}
	return cookie.Value, nil
}

type passkeyOptionsOutput struct {
	Body struct {
		Options     any    `json:"options"`
		ChallengeID string `json:"challengeId"`
	}
	SetCookie []string `header:"Set-Cookie"`
}

func (d *Deps) handlePasskeyRegisterBegin(ctx context.Context, _ *struct{}) (*passkeyOptionsOutput, error) {
	user := web.UserFrom(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	options, challengeID, err := d.Passkeys.BeginRegistration(ctx, user.ID)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to start registration")
	}
	out := &passkeyOptionsOutput{}
	out.Body.Options = options
	out.Body.ChallengeID = challengeID
	out.SetCookie = []string{d.setPasskeyChallengeCookieValue(challengeID)}
	return out, nil
}

type passkeyRegisterFinishRequest struct {
	Credential json.RawMessage `json:"credential"`
	Name       string          `json:"name,omitempty"`
}

type passkeyRegisterFinishOutput struct {
	Body struct {
		Passkey coreauth.Passkey `json:"passkey"`
	}
	SetCookie []string `header:"Set-Cookie"`
}

func (d *Deps) handlePasskeyRegisterFinish(ctx context.Context, in *struct{ Body passkeyRegisterFinishRequest }) (*passkeyRegisterFinishOutput, error) {
	user := web.UserFrom(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	challengeID, err := d.challengeCookie(ctx)
	if err != nil {
		return nil, err
	}
	passkey, err := d.Passkeys.FinishRegistration(ctx, user.ID, challengeID, in.Body.Credential)
	if err != nil {
		return nil, huma.Error400BadRequest("registration failed")
	}
	out := &passkeyRegisterFinishOutput{}
	out.Body.Passkey = passkey
	out.SetCookie = []string{d.clearPasskeyChallengeCookieValue()}
	return out, nil
}

type passkeyAuthBeginOutput = passkeyOptionsOutput

func (d *Deps) handlePasskeyAuthBegin(ctx context.Context, _ *struct{}) (*passkeyAuthBeginOutput, error) {
	options, challengeID, err := d.Passkeys.BeginAuthentication(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to start authentication")
	}
	out := &passkeyAuthBeginOutput{}
	out.Body.Options = options
	out.Body.ChallengeID = challengeID
	out.SetCookie = []string{d.setPasskeyChallengeCookieValue(challengeID)}
	return out, nil
}

type passkeyAuthFinishRequest struct {
	Credential json.RawMessage `json:"credential"`
}

func (d *Deps) handlePasskeyAuthFinish(ctx context.Context, in *struct{ Body passkeyAuthFinishRequest }) (*signInOutput, error) {
	challengeID, err := d.challengeCookie(ctx)
	if err != nil {
		return nil, err
	}
	userID, err := d.Passkeys.FinishAuthentication(ctx, challengeID, in.Body.Credential)
	if err != nil {
		return nil, huma.Error400BadRequest("authentication failed")
	}
	user, err := d.Store.GetUserByID(ctx, userID)
	if err != nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	cookie, err := d.createSession(ctx, user)
	if err != nil {
		return nil, err
	}
	return &signInOutput{Body: userBody{User: toAuthUser(user)}, SetCookie: []string{cookie}}, nil
}

func (d *Deps) handleListPasskeys(ctx context.Context, _ *struct{}) (*web.ListOutput[coreauth.Passkey], error) {
	user := web.UserFrom(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	passkeys, err := d.Passkeys.List(ctx, user.ID)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to list passkeys")
	}
	if passkeys == nil {
		passkeys = []coreauth.Passkey{}
	}
	return &web.ListOutput[coreauth.Passkey]{Body: passkeys}, nil
}

func (d *Deps) handleDeletePasskey(ctx context.Context, in *idInput) (*web.OKResponse, error) {
	user := web.UserFrom(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	if err := d.Passkeys.Delete(ctx, user.ID, in.ID); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to delete passkey")
	}
	return web.OK(), nil
}

func (d *Deps) registerPasskeys(api huma.API) {
	huma.Post(api, "/api/auth/passkey/register/begin", d.handlePasskeyRegisterBegin, d.SessionMW)
	huma.Post(api, "/api/auth/passkey/register/finish", d.handlePasskeyRegisterFinish, d.SessionMW)
	huma.Post(api, "/api/auth/passkey/auth/begin", d.handlePasskeyAuthBegin, d.SessionMW)
	huma.Post(api, "/api/auth/passkey/auth/finish", d.handlePasskeyAuthFinish, d.SessionMW)
}
