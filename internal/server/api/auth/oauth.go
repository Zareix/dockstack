package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"strings"
	"time"
	"uuid"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/go-chi/chi/v5"
	"golang.org/x/oauth2"

	coreauth "github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/server/api/web"
)

const oauthStateCookie = "dockstack_oauth_state"

func (d *Deps) oauthConfig(ctx context.Context) (*oauth2.Config, *oidc.Provider, error) {
	provider, err := oidc.NewProvider(ctx, d.Cfg.OAuth.DiscoveryURL)
	if err != nil {
		return nil, nil, err
	}
	cfg := &oauth2.Config{
		ClientID:     d.Cfg.OAuth.ClientID,
		ClientSecret: d.Cfg.OAuth.ClientSecret,
		Endpoint:     provider.Endpoint(),
		RedirectURL:  d.appURL() + "/api/auth/oauth/" + d.Cfg.OAuth.ProviderID + "/callback",
		Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
	}
	return cfg, provider, nil
}

func (d *Deps) appURL() string {
	if d.Cfg.AppURL != "" {
		return strings.TrimSuffix(d.Cfg.AppURL, "/")
	}
	return "http://localhost:3000"
}

func (d *Deps) signOAuthState() (string, string) {
	token := uuid.New().String()
	mac := hmac.New(sha256.New, []byte(d.Cfg.AuthSecret))
	mac.Write([]byte(token))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return token, token + "." + sig
}

func (d *Deps) verifyOAuthState(state string) bool {
	idx := strings.LastIndex(state, ".")
	if idx < 0 {
		return false
	}
	token, sig := state[:idx], state[idx+1:]
	mac := hmac.New(sha256.New, []byte(d.Cfg.AuthSecret))
	mac.Write([]byte(token))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sig))
}

func (d *Deps) handleOAuthStart(w http.ResponseWriter, r *http.Request) {
	if d.Cfg.OAuth == nil {
		web.WriteError(w, http.StatusNotFound, "OAuth not configured")
		return
	}
	providerID := chi.URLParam(r, "provider")
	if providerID != d.Cfg.OAuth.ProviderID {
		web.WriteError(w, http.StatusNotFound, "unknown provider")
		return
	}
	cfg, _, err := d.oauthConfig(r.Context())
	if err != nil {
		web.LogError(r, err)
		web.WriteError(w, http.StatusInternalServerError, "failed to configure OAuth")
		return
	}
	state, signed := d.signOAuthState()
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    signed,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   d.Store.Secure(),
		MaxAge:   600,
	})
	http.Redirect(w, r, cfg.AuthCodeURL(state), http.StatusFound)
}

func (d *Deps) handleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if d.Cfg.OAuth == nil {
		web.WriteError(w, http.StatusNotFound, "OAuth not configured")
		return
	}
	providerID := chi.URLParam(r, "provider")
	if providerID != d.Cfg.OAuth.ProviderID {
		web.WriteError(w, http.StatusNotFound, "unknown provider")
		return
	}
	stateParam := r.URL.Query().Get("state")
	if !d.verifyOAuthState(stateParam) {
		web.WriteError(w, http.StatusBadRequest, "invalid state")
		return
	}
	stateCookie, err := r.Cookie(oauthStateCookie)
	if err != nil || !d.verifyOAuthState(stateCookie.Value) || stateCookie.Value != stateParam {
		web.WriteError(w, http.StatusBadRequest, "invalid state")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   d.Store.Secure(),
		MaxAge:   -1,
	})

	cfg, provider, err := d.oauthConfig(r.Context())
	if err != nil {
		web.LogError(r, err)
		web.WriteError(w, http.StatusInternalServerError, "failed to configure OAuth")
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		web.WriteError(w, http.StatusBadRequest, "missing code")
		return
	}
	token, err := cfg.Exchange(r.Context(), code)
	if err != nil {
		web.LogError(r, err)
		web.WriteError(w, http.StatusBadRequest, "failed to exchange code")
		return
	}
	userInfo, err := provider.UserInfo(r.Context(), oauth2.StaticTokenSource(token))
	if err != nil {
		web.LogError(r, err)
		web.WriteError(w, http.StatusBadRequest, "failed to fetch user info")
		return
	}
	email := userInfo.Email
	sub := userInfo.Subject
	if email == "" {
		web.WriteError(w, http.StatusBadRequest, "OAuth provider did not return an email")
		return
	}

	ctx := r.Context()
	user, err := d.findOrLinkOAuthUser(ctx, providerID, sub, email)
	if err != nil {
		web.LogError(r, err)
		web.WriteError(w, http.StatusInternalServerError, "failed to link account")
		return
	}
	signed, _, err := d.Store.CreateSession(ctx, user.ID, clientIP(r), r.UserAgent())
	if err != nil {
		web.LogError(r, err)
		web.WriteError(w, http.StatusInternalServerError, "failed to create session")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     coreauth.CookieName,
		Value:    signed,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   d.Store.Secure(),
	})
	http.Redirect(w, r, d.appURL()+"/", http.StatusFound)
}

func (d *Deps) findOrLinkOAuthUser(ctx context.Context, providerID, sub, email string) (*coreauth.User, error) {
	var userID string
	err := d.DB.QueryRowContext(ctx,
		`SELECT user_id FROM oauth_accounts WHERE provider_id = ? AND provider_user_id = ?`,
		providerID, sub).Scan(&userID)
	if err == nil {
		return d.Store.GetUserByID(ctx, userID)
	}

	user, err := d.Store.UserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {

		id := uuid.New().String()
		now := time.Now().UnixMilli()
		if _, err := d.DB.ExecContext(ctx,
			`INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
			 VALUES (?, ?, ?, 1, ?, ?)`,
			id, strings.SplitN(email, "@", 2)[0], email, now, now); err != nil {
			return nil, err
		}
		user, err = d.Store.GetUserByID(ctx, id)
		if err != nil {
			return nil, err
		}
	}
	if _, err := d.DB.ExecContext(ctx,
		`INSERT INTO oauth_accounts (id, user_id, provider_id, provider_user_id, email, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		uuid.New().String(), user.ID, providerID, sub, email, time.Now().UnixMilli()); err != nil {
		return nil, err
	}
	return user, nil
}

func (d *Deps) registerOAuth(router chi.Router) {
	if d.Cfg.OAuth == nil {
		return
	}
	router.Get("/api/auth/oauth/{provider}", d.handleOAuthStart)
	router.Get("/api/auth/oauth/{provider}/callback", d.handleOAuthCallback)
}
