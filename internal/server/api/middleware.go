package api

import (
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"

	"github.com/zareix/dockstack/internal/server/api/web"
)

type apiError struct {
	status int
	Err    string `json:"error"`
}

func (e *apiError) Error() string  { return e.Err }
func (e *apiError) GetStatus() int { return e.status }

func init() {
	huma.NewError = func(status int, msg string, errs ...error) huma.StatusError {
		if len(errs) > 0 {
			details := make([]string, len(errs))
			for i, e := range errs {
				details[i] = e.Error()
			}
			return &apiError{status: status, Err: msg + ": " + strings.Join(details, "; ")}
		}
		return &apiError{status: status, Err: msg}
	}
}

var WriteError = web.WriteError

func (d *Deps) requestMiddleware(ctx huma.Context, next func(huma.Context)) {
	if r, _ := humachi.Unwrap(ctx); r != nil {
		ctx = huma.WithValue(ctx, web.RequestKey, r)
	}
	next(ctx)
}

func (d *Deps) apiKeyMW(o *huma.Operation) {
	o.Middlewares = append(o.Middlewares, d.humaRequireAPIKey)
}

func (d *Deps) humaRequireAPIKey(ctx huma.Context, next func(huma.Context)) {
	r, w := humachi.Unwrap(ctx)
	authHeader := r.Header.Get("Authorization")
	token, ok := strings.CutPrefix(authHeader, "Bearer ")
	if !ok || strings.TrimSpace(token) == "" {
		web.WriteError(w, 401, "No API key provided, provide one via the Authorization header")
		return
	}
	key, err := d.Keys.VerifyKey(ctx.Context(), strings.TrimSpace(token))
	if err != nil {
		web.WriteError(w, 401, err.Error())
		return
	}
	if ok, err := d.Keys.RateLimit(ctx.Context(), key.ID, key.RateLimitMax(), key.RateLimitWindow()); err != nil || !ok {
		if err != nil {
			web.WriteError(w, 500, "rate limit error")
			return
		}
		web.WriteError(w, 429, "Rate limit exceeded")
		return
	}
	user, err := d.Store.GetUserByID(ctx.Context(), key.UserID)
	if err != nil {
		web.WriteError(w, 401, "Unauthorized")
		return
	}
	ctx = huma.WithValue(ctx, web.CtxUser, user)
	ctx = huma.WithValue(ctx, web.CtxAPIKey, key)
	next(ctx)
}
