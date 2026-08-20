package server

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/coder/websocket"

	"github.com/zareix/dockstack/internal/auth"
)

// handleWSAuth authenticates a WebSocket upgrade via session cookie or
// ?token= API key query parameter, then hands off to the inner handler.
func (s *Server) handleWSAuth(inner http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cookie, err := r.Cookie(auth.CookieName); err == nil {
			if sess, user, err := s.store.SessionUserFromCookie(r.Context(), cookie.Value); err == nil {
				ctx := WithUser(r.Context(), user, sess, nil)
				inner(w, r.WithContext(ctx))
				return
			}
		}
		if token := r.URL.Query().Get("token"); token != "" {
			key, err := s.keys.VerifyKey(r.Context(), token)
			if err == nil {
				user, err := s.store.GetUserByID(r.Context(), key.UserID)
				if err == nil {
					ctx := WithUser(r.Context(), user, nil, key)
					inner(w, r.WithContext(ctx))
					return
				}
			}
		}
		writeError(w, http.StatusUnauthorized, "Unauthorized")
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
