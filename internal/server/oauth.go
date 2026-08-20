package server

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/go-chi/chi/v5"
	"golang.org/x/oauth2"

	"github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/randid"
)

const oauthStateCookie = "dockstack_oauth_state"

func (s *Server) oauthConfig(ctx context.Context) (*oauth2.Config, *oidc.Provider, error) {
	provider, err := oidc.NewProvider(ctx, s.cfg.OAuth.DiscoveryURL)
	if err != nil {
		return nil, nil, err
	}
	cfg := &oauth2.Config{
		ClientID:     s.cfg.OAuth.ClientID,
		ClientSecret: s.cfg.OAuth.ClientSecret,
		Endpoint:     provider.Endpoint(),
		RedirectURL:  s.appURL() + "/api/auth/oauth/" + s.cfg.OAuth.ProviderID + "/callback",
		Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
	}
	return cfg, provider, nil
}

func (s *Server) appURL() string {
	if s.cfg.AppURL != "" {
		return strings.TrimSuffix(s.cfg.AppURL, "/")
	}
	return "http://localhost:3000"
}

func (s *Server) signOAuthState() (string, string) {
	token := randid.New()
	mac := hmac.New(sha256.New, []byte(s.cfg.AuthSecret))
	mac.Write([]byte(token))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return token, token + "." + sig
}

func (s *Server) verifyOAuthState(state string) bool {
	idx := strings.LastIndex(state, ".")
	if idx < 0 {
		return false
	}
	token, sig := state[:idx], state[idx+1:]
	mac := hmac.New(sha256.New, []byte(s.cfg.AuthSecret))
	mac.Write([]byte(token))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sig))
}

func (s *Server) handleOAuthStart(w http.ResponseWriter, r *http.Request) {
	if s.cfg.OAuth == nil {
		writeError(w, http.StatusNotFound, "OAuth not configured")
		return
	}
	providerID := chi.URLParam(r, "provider")
	if providerID != s.cfg.OAuth.ProviderID {
		writeError(w, http.StatusNotFound, "unknown provider")
		return
	}
	cfg, _, err := s.oauthConfig(r.Context())
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to configure OAuth")
		return
	}
	state, signed := s.signOAuthState()
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    signed,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.store.Secure(),
		MaxAge:   600,
	})
	http.Redirect(w, r, cfg.AuthCodeURL(state), http.StatusFound)
}

func (s *Server) handleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if s.cfg.OAuth == nil {
		writeError(w, http.StatusNotFound, "OAuth not configured")
		return
	}
	providerID := chi.URLParam(r, "provider")
	if providerID != s.cfg.OAuth.ProviderID {
		writeError(w, http.StatusNotFound, "unknown provider")
		return
	}
	stateParam := r.URL.Query().Get("state")
	if !s.verifyOAuthState(stateParam) {
		writeError(w, http.StatusBadRequest, "invalid state")
		return
	}
	stateCookie, err := r.Cookie(oauthStateCookie)
	if err != nil || !s.verifyOAuthState(stateCookie.Value) || stateCookie.Value != stateParam {
		writeError(w, http.StatusBadRequest, "invalid state")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.store.Secure(),
		MaxAge:   -1,
	})

	cfg, provider, err := s.oauthConfig(r.Context())
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to configure OAuth")
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		writeError(w, http.StatusBadRequest, "missing code")
		return
	}
	token, err := cfg.Exchange(r.Context(), code)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusBadRequest, "failed to exchange code")
		return
	}
	userInfo, err := provider.UserInfo(r.Context(), oauth2.StaticTokenSource(token))
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusBadRequest, "failed to fetch user info")
		return
	}
	email := userInfo.Email
	sub := userInfo.Subject
	if email == "" {
		writeError(w, http.StatusBadRequest, "OAuth provider did not return an email")
		return
	}

	ctx := r.Context()
	user, err := s.findOrLinkOAuthUser(ctx, providerID, sub, email)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to link account")
		return
	}
	signed, _, err := s.store.CreateSession(ctx, user.ID, clientIP(r), r.UserAgent())
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}
	s.setSessionCookie(w, signed)
	http.Redirect(w, r, s.appURL()+"/", http.StatusFound)
}

// findOrLinkOAuthUser returns a user for an OAuth identity, creating the user
// and linking the account if needed.
func (s *Server) findOrLinkOAuthUser(ctx context.Context, providerID, sub, email string) (*auth.User, error) {
	var userID string
	err := s.db.QueryRowContext(ctx,
		`SELECT user_id FROM oauth_accounts WHERE provider_id = ? AND provider_user_id = ?`,
		providerID, sub).Scan(&userID)
	if err == nil {
		return s.store.GetUserByID(ctx, userID)
	}
	// Not linked yet: look up by email.
	user, err := s.store.UserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		// Create a new user.
		id := randid.New()
		now := time.Now().UnixMilli()
		if _, err := s.db.ExecContext(ctx,
			`INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
			 VALUES (?, ?, ?, 1, ?, ?)`,
			id, strings.SplitN(email, "@", 2)[0], email, now, now); err != nil {
			return nil, err
		}
		user, err = s.store.GetUserByID(ctx, id)
		if err != nil {
			return nil, err
		}
	}
	if _, err := s.db.ExecContext(ctx,
		`INSERT INTO oauth_accounts (id, user_id, provider_id, provider_user_id, email, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		randid.New(), user.ID, providerID, sub, email, time.Now().UnixMilli()); err != nil {
		return nil, err
	}
	return user, nil
}
