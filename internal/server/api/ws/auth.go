package ws

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"

	"github.com/zareix/dockstack/internal/auth"
	dockerapi "github.com/zareix/dockstack/internal/docker"
	"github.com/zareix/dockstack/internal/server/api/web"
)

// Deps carries what the WebSocket endpoints need from the server.
type Deps struct {
	Store  *auth.Store
	Docker *dockerapi.Client
	Stacks *dockerapi.Stacks
}

// Mount registers the WebSocket routes on the router.
func Mount(router chi.Router, d *Deps) {
	router.HandleFunc("/api/ws/exec", d.handleWSAuth(d.handleExecWS))
	router.HandleFunc("/api/ws/logs", d.handleWSAuth(d.handleLogsWS))
}

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
			key, err := d.Store.VerifyKey(r.Context(), token)
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
