package auth

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"

	coreauth "github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/server/api/web"
)

func (d *Deps) SessionMW(o *huma.Operation) {
	o.Middlewares = append(o.Middlewares, d.humaRequireSession)
}

func (d *Deps) humaRequireSession(ctx huma.Context, next func(huma.Context)) {
	r, w := humachi.Unwrap(ctx)
	cookie, err := r.Cookie(coreauth.CookieName)
	if err != nil {
		web.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	sess, user, err := d.Store.SessionUserFromCookie(ctx.Context(), cookie.Value)
	if err != nil {
		web.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	ctx = huma.WithValue(ctx, web.CtxUser, user)
	ctx = huma.WithValue(ctx, web.CtxSession, sess)
	next(ctx)
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
