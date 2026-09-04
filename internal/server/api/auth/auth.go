package auth

import (
	"database/sql"

	"context"
	"errors"

	"github.com/danielgtaylor/huma/v2"

	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"
	"uuid"

	coreauth "github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/config"
	"github.com/zareix/dockstack/internal/server/api/web"
)

type Deps struct {
	Cfg   *config.Config
	DB    *sql.DB
	Store *coreauth.Store
}

type authUserResponse struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"emailVerified"`
	Username      string `json:"username"`
	Avatar        string `json:"avatar"`
	Role          string `json:"role"`
	CreatedAt     int64  `json:"createdAt"`
}

type authSessionResponse struct {
	ID        string `json:"id"`
	ExpiresAt int64  `json:"expiresAt"`
	UserAgent string `json:"userAgent"`
	IPAddress string `json:"ipAddress"`
	CreatedAt int64  `json:"createdAt"`
	IsCurrent bool   `json:"isCurrent"`
}

func toAuthUser(u *coreauth.User) authUserResponse {
	return authUserResponse{
		ID:            u.ID,
		Name:          u.Name,
		Email:         u.Email,
		EmailVerified: u.EmailVerified,
		Username:      u.Username,
		Avatar:        u.Avatar,
		Role:          u.Role,
		CreatedAt:     u.CreatedAt,
	}
}

func (d *Deps) setCookieString(name, value string, maxAge int) string {
	return (&http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   d.Store.Secure(),
		MaxAge:   maxAge,
	}).String()
}

func (d *Deps) createSession(ctx context.Context, user *coreauth.User) (string, error) {
	r := web.RequestFrom(ctx)
	if user == nil {
		return "", huma.Error401Unauthorized("Invalid credentials")
	}
	signed, _, err := d.Store.CreateSession(ctx, user.ID, clientIP(r), r.UserAgent())
	if err != nil {
		web.LogError(r, err)
		return "", huma.Error500InternalServerError("failed to create session")
	}
	return d.setCookieString(coreauth.CookieName, signed, 0), nil
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

type signInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type userBody struct {
	User authUserResponse `json:"user"`
}

type signInOutput struct {
	Body      userBody
	SetCookie []string `header:"Set-Cookie"`
}

func (d *Deps) handleSignInEmail(ctx context.Context, in *struct{ Body signInRequest }) (*signInOutput, error) {
	return d.signInWithPassword(ctx, in.Body.Email, in.Body.Password, "email and password are required", d.Store.UserByEmail)
}

func (d *Deps) handleSignInUsername(ctx context.Context, in *struct{ Body signInUsernameRequest }) (*signInOutput, error) {
	return d.signInWithPassword(ctx, in.Body.Username, in.Body.Password, "username and password are required", d.Store.UserByUsername)
}

func (d *Deps) signInWithPassword(ctx context.Context, identifier, password, missingMsg string, lookup func(context.Context, string) (*coreauth.User, error)) (*signInOutput, error) {
	if identifier == "" || password == "" {
		return nil, huma.Error400BadRequest(missingMsg)
	}
	user, err := lookup(ctx, identifier)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to look up user")
	}
	if user == nil {
		return nil, huma.Error401Unauthorized("Invalid credentials")
	}
	ok, err := d.Store.VerifyPassword(ctx, user.ID, password)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to verify password")
	}
	if !ok {
		return nil, huma.Error401Unauthorized("Invalid credentials")
	}
	cookie, err := d.createSession(ctx, user)
	if err != nil {
		return nil, err
	}
	return &signInOutput{Body: userBody{User: toAuthUser(user)}, SetCookie: []string{cookie}}, nil
}

type signInUsernameRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type usernameAvailableRequest struct {
	Username string `json:"username,omitempty"`
}

type usernameAvailableOutput struct {
	Body struct {
		Available bool `json:"available"`
	}
}

func (d *Deps) handleUsernameAvailable(ctx context.Context, in *struct{ Body usernameAvailableRequest }) (*usernameAvailableOutput, error) {
	taken, err := d.Store.UsernameTaken(ctx, in.Body.Username)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to check username")
	}
	out := &usernameAvailableOutput{}
	out.Body.Available = !taken
	return out, nil
}

type signOutOutput struct {
	Body      map[string]bool
	SetCookie []string `header:"Set-Cookie"`
}

func (d *Deps) handleSignOut(ctx context.Context, _ *struct{}) (*signOutOutput, error) {
	r := web.RequestFrom(ctx)
	if sess := web.SessionFrom(ctx); sess != nil {
		_ = d.Store.RevokeSession(ctx, sess.UserID, sess.ID)
	} else if cookie, err := r.Cookie(coreauth.CookieName); err == nil {
		if token, ok := d.Store.VerifySignature(cookie.Value); ok {
			_ = d.Store.DeleteSessionByToken(ctx, token)
		}
	}
	return &signOutOutput{
		Body:      map[string]bool{"success": true},
		SetCookie: []string{d.setCookieString(coreauth.CookieName, "", -1)},
	}, nil
}

type getSessionResponse struct {
	Body struct {
		Session authSessionResponse `json:"session"`
		User    authUserResponse    `json:"user"`
	}
}

func (d *Deps) handleGetSession(ctx context.Context, _ *struct{}) (*getSessionResponse, error) {
	user, sess := sessionAndUserFromContext(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	resp := &getSessionResponse{}
	resp.Body.Session = authSessionResponse{
		ID:        sess.ID,
		ExpiresAt: sess.ExpiresAt,
		UserAgent: sess.UserAgent,
		IPAddress: sess.IPAddress,
		CreatedAt: sess.CreatedAt,
		IsCurrent: true,
	}
	resp.Body.User = toAuthUser(user)
	return resp, nil
}

func sessionAndUserFromContext(ctx context.Context) (*coreauth.User, *coreauth.Session) {
	return web.UserFrom(ctx), web.SessionFrom(ctx)
}

func (d *Deps) handleListSessions(ctx context.Context, _ *struct{}) (*web.ListOutput[authSessionResponse], error) {
	user, current := sessionAndUserFromContext(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	sessions, err := d.Store.ListSessions(ctx, user.ID)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to list sessions")
	}
	out := make([]authSessionResponse, 0, len(sessions))
	for _, sess := range sessions {
		out = append(out, authSessionResponse{
			ID:        sess.ID,
			ExpiresAt: sess.ExpiresAt,
			UserAgent: sess.UserAgent,
			IPAddress: sess.IPAddress,
			CreatedAt: sess.CreatedAt,
			IsCurrent: current != nil && current.ID == sess.ID,
		})
	}
	return &web.ListOutput[authSessionResponse]{Body: out}, nil
}

type sessionIDInput struct {
	ID string `path:"id"`
}

func (d *Deps) handleRevokeSession(ctx context.Context, in *sessionIDInput) (*web.OKResponse, error) {
	user, _ := sessionAndUserFromContext(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	if err := d.Store.RevokeSession(ctx, user.ID, in.ID); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to revoke session")
	}
	return web.OK(), nil
}

func (d *Deps) handleRevokeOthers(ctx context.Context, _ *struct{}) (*web.OKResponse, error) {
	user, current := sessionAndUserFromContext(ctx)
	if user == nil || current == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	if err := d.Store.RevokeOtherSessions(ctx, user.ID, current.ID); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to revoke sessions")
	}
	return web.OK(), nil
}

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword,omitempty"`
	NewPassword     string `json:"newPassword"`
}

func (d *Deps) handleChangePassword(ctx context.Context, in *struct{ Body changePasswordRequest }) (*web.OKResponse, error) {
	user, _ := sessionAndUserFromContext(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	if in.Body.NewPassword == "" {
		return nil, huma.Error400BadRequest("new password is required")
	}
	valid, err := d.Store.VerifyPassword(ctx, user.ID, in.Body.CurrentPassword)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to verify password")
	}
	if !valid {
		return nil, huma.Error400BadRequest("current password is incorrect")
	}
	if err := d.Store.SetPassword(ctx, user.ID, in.Body.NewPassword); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to change password")
	}
	return web.OK(), nil
}

type changeEmailRequest struct {
	Email string `json:"email,omitempty"`
}

func (d *Deps) handleChangeEmail(ctx context.Context, in *struct{ Body changeEmailRequest }) (*web.OKResponse, error) {
	user, _ := sessionAndUserFromContext(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	if in.Body.Email == "" || !strings.Contains(in.Body.Email, "@") {
		return nil, huma.Error400BadRequest("invalid email")
	}
	if err := d.Store.ChangeEmail(ctx, user.ID, in.Body.Email); err != nil {
		if isUniqueViolation(err) {
			return nil, huma.Error409Conflict("email already in use")
		}
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to change email")
	}
	return web.OK(), nil
}

type updateUserRequest struct {
	Name   string `json:"name,omitempty"`
	Avatar string `json:"avatar,omitempty"`
}

func (d *Deps) handleUpdateUser(ctx context.Context, in *struct{ Body updateUserRequest }) (*signInOutput, error) {
	user, _ := sessionAndUserFromContext(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	if err := d.Store.UpdateUser(ctx, user.ID, in.Body.Name, in.Body.Avatar); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to update user")
	}
	updated, err := d.Store.GetUserByID(ctx, user.ID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to reload user")
	}
	return &signInOutput{Body: userBody{User: toAuthUser(updated)}}, nil
}

type forgotPasswordRequest struct {
	Email string `json:"email,omitempty"`
}

func (d *Deps) handleForgotPassword(ctx context.Context, in *struct{ Body forgotPasswordRequest }) (*web.OKResponse, error) {
	user, err := d.Store.UserByEmail(ctx, in.Body.Email)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to look up user")
	}

	if user != nil {
		token, err := coreauth.GenerateResetToken()
		if err != nil {
			web.LogError(web.RequestFrom(ctx), err)
			return nil, huma.Error500InternalServerError("failed to generate token")
		}
		if _, err := d.DB.ExecContext(ctx,
			`INSERT INTO reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
			uuid.New().String(), user.ID, coreauth.HashToken(token), time.Now().Add(time.Hour).UnixMilli(),
			time.Now().UnixMilli()); err != nil {
			web.LogError(web.RequestFrom(ctx), err)
			return nil, huma.Error500InternalServerError("failed to create reset token")
		}
		slog.Warn("password reset token generated (no SMTP configured)", "email", user.Email, "token", token)
	}
	return web.OK(), nil
}

type resetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

func (d *Deps) handleResetPassword(ctx context.Context, in *struct{ Body resetPasswordRequest }) (*web.OKResponse, error) {
	if in.Body.Token == "" || in.Body.NewPassword == "" {
		return nil, huma.Error400BadRequest("token and new password are required")
	}
	var userID string
	row := d.DB.QueryRowContext(ctx,
		`SELECT user_id FROM reset_tokens WHERE token_hash = ? AND expires_at > ?`,
		coreauth.HashToken(in.Body.Token), time.Now().UnixMilli())
	if err := row.Scan(&userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, huma.Error400BadRequest("invalid or expired token")
		}
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to look up token")
	}
	if err := d.Store.SetPassword(ctx, userID, in.Body.NewPassword); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to reset password")
	}
	if _, err := d.DB.ExecContext(ctx,
		`DELETE FROM reset_tokens WHERE user_id = ?`, userID); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
	}
	return web.OK(), nil
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "unique")
}

func (d *Deps) registerAuth(api huma.API) {
	huma.Post(api, "/api/auth/sign-in/email", d.handleSignInEmail)
	huma.Post(api, "/api/auth/sign-in/username", d.handleSignInUsername)
	huma.Post(api, "/api/auth/is-username-available", d.handleUsernameAvailable)
	huma.Post(api, "/api/auth/sign-out", d.handleSignOut)
	huma.Post(api, "/api/auth/forgot-password", d.handleForgotPassword)
	huma.Post(api, "/api/auth/reset-password", d.handleResetPassword)

	huma.Get(api, "/api/auth/session", d.handleGetSession, d.AuthMW)
	huma.Get(api, "/api/auth/sessions", d.handleListSessions, d.AuthMW)
	huma.Post(api, "/api/auth/sessions/{id}/revoke", d.handleRevokeSession, d.AuthMW)
	huma.Post(api, "/api/auth/sessions/revoke-others", d.handleRevokeOthers, d.AuthMW)
	huma.Post(api, "/api/auth/change-password", d.handleChangePassword, d.AuthMW)
	huma.Post(api, "/api/auth/change-email", d.handleChangeEmail, d.AuthMW)
	huma.Patch(api, "/api/auth/user", d.handleUpdateUser, d.AuthMW)
}
