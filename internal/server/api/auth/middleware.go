package auth

import (
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"

	coreauth "github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/server/api/web"
)

func (d *Deps) AuthMW(o *huma.Operation) {
	o.Middlewares = append(o.Middlewares, d.HumaRequireAuth)
}

func (d *Deps) HumaRequireAuth(ctx huma.Context, next func(huma.Context)) {
	r, w := humachi.Unwrap(ctx)

	if token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer "); ok && strings.TrimSpace(token) != "" {
		key, err := d.Store.VerifyKey(ctx.Context(), strings.TrimSpace(token))
		if err != nil {
			web.WriteError(w, 401, err.Error())
			return
		}
		if ok, err := d.Store.RateLimit(ctx.Context(), key.ID, key.RateLimitMax(), key.RateLimitWindow()); err != nil || !ok {
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
		return
	}

	if cookie, err := r.Cookie(coreauth.CookieName); err == nil {
		if sess, user, err := d.Store.SessionUserFromCookie(ctx.Context(), cookie.Value); err == nil {
			ctx = huma.WithValue(ctx, web.CtxUser, user)
			ctx = huma.WithValue(ctx, web.CtxSession, sess)
			next(ctx)
			return
		}
	}

	web.WriteError(w, 401, "Unauthorized")
}

func (d *Deps) RequireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(coreauth.CookieName)
		if err != nil {
			web.WriteError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}
		sess, user, err := d.Store.SessionUserFromCookie(r.Context(), cookie.Value)
		if err != nil {
			web.WriteError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}
		next.ServeHTTP(w, r.WithContext(web.WithUser(r.Context(), user, sess, nil)))
	})
}
