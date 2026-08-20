package server

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/zareix/dockstack/internal/auth"
)

type ctxKey int

const (
	ctxUser ctxKey = iota
	ctxSession
	ctxAPIKey
)

func WithUser(ctx context.Context, u *auth.User, sess *auth.Session, key *auth.APIKey) context.Context {
	ctx = context.WithValue(ctx, ctxUser, u)
	if sess != nil {
		ctx = context.WithValue(ctx, ctxSession, sess)
	}
	if key != nil {
		ctx = context.WithValue(ctx, ctxAPIKey, key)
	}
	return ctx
}

func UserFrom(ctx context.Context) *auth.User {
	u, _ := ctx.Value(ctxUser).(*auth.User)
	return u
}

func SessionFrom(ctx context.Context) *auth.Session {
	s, _ := ctx.Value(ctxSession).(*auth.Session)
	return s
}

func APIKeyFrom(ctx context.Context) *auth.APIKey {
	k, _ := ctx.Value(ctxAPIKey).(*auth.APIKey)
	return k
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// requireSession gates a handler behind a valid session cookie.
func (s *Server) requireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(auth.CookieName)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}
		sess, user, err := s.store.SessionUserFromCookie(r.Context(), cookie.Value)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}
		r = r.WithContext(WithUser(r.Context(), user, sess, nil))
		next.ServeHTTP(w, r)
	})
}

// requireAPIKey gates a handler behind a valid Bearer API key.
func (s *Server) requireAPIKey(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		token, ok := strings.CutPrefix(authHeader, "Bearer ")
		if !ok || strings.TrimSpace(token) == "" {
			writeError(w, http.StatusUnauthorized, "No API key provided, provide one via the Authorization header")
			return
		}
		key, err := s.keys.VerifyKey(r.Context(), strings.TrimSpace(token))
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		if ok, err := s.keys.RateLimit(r.Context(), key.ID, key.RateLimitMax(), key.RateLimitWindow()); err != nil || !ok {
			if err != nil {
				writeError(w, http.StatusInternalServerError, "rate limit error")
				return
			}
			writeError(w, http.StatusTooManyRequests, "Rate limit exceeded")
			return
		}
		user, err := s.store.GetUserByID(r.Context(), key.UserID)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}
		r = r.WithContext(WithUser(r.Context(), user, nil, key))
		next.ServeHTTP(w, r)
	})
}

// requireAny accepts either a session cookie or a Bearer API key.
func (s *Server) requireAny(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if cookie, err := r.Cookie(auth.CookieName); err == nil {
			if sess, user, err := s.store.SessionUserFromCookie(r.Context(), cookie.Value); err == nil {
				r = r.WithContext(WithUser(r.Context(), user, sess, nil))
				next.ServeHTTP(w, r)
				return
			}
		}
		s.requireAPIKey(next).ServeHTTP(w, r)
	})
}

// statusRecorder captures the response status code for logging.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (w *statusRecorder) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusRecorder) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(b)
	w.bytes += n
	return n, err
}

// Flush implements http.Flusher for SSE/streaming responses.
func (w *statusRecorder) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// requestLogger logs each request with structured fields.
func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w}
		next.ServeHTTP(rec, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"bytes", rec.bytes,
			"duration", time.Since(start).Round(time.Microsecond).String(),
			"remote", r.RemoteAddr,
		)
	})
}
