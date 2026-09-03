package api

import (
	"context"
	"encoding/json"
	"github.com/zareix/dockstack/internal/server/api/web"
	"net/http"

	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"

	"github.com/zareix/dockstack/internal/auth"
)

func (d *Deps) handleWSAuth(inner http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cookie, err := r.Cookie(auth.CookieName); err == nil {
			if sess, user, err := d.Store.SessionUserFromCookie(r.Context(), cookie.Value); err == nil {
				ctx := web.WithUser(r.Context(), user, sess, nil)
				inner(w, r.WithContext(ctx))
				return
			}
		}
		if token := r.URL.Query().Get("token"); token != "" {
			key, err := d.Keys.VerifyKey(r.Context(), token)
			if err == nil {
				user, err := d.Store.GetUserByID(r.Context(), key.UserID)
				if err == nil {
					ctx := web.WithUser(r.Context(), user, nil, key)
					inner(w, r.WithContext(ctx))
					return
				}
			}
		}
		web.WriteError(w, http.StatusUnauthorized, "Unauthorized")
	}
}

func acceptWS(w http.ResponseWriter, r *http.Request) (*websocket.Conn, error) {
	return websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
}

func sendWSJSON(conn *websocket.Conn, v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return conn.Write(context.Background(), websocket.MessageText, data)
}

func (d *Deps) registerWS(router chi.Router) {
	router.HandleFunc("/api/ws/exec", d.handleWSAuth(d.handleExecWS))
	router.HandleFunc("/api/ws/logs", d.handleWSAuth(d.handleLogsWS))
}
