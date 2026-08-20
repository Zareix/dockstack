package server

import (
	"database/sql"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/randid"
)

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

func toAuthUser(u *auth.User) authUserResponse {
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

func (s *Server) authRoutes() chi.Router {
	r := chi.NewRouter()
	r.Post("/sign-in/email", s.handleSignInEmail)
	r.Post("/sign-in/username", s.handleSignInUsername)
	r.Post("/is-username-available", s.handleUsernameAvailable)
	r.Post("/sign-out", s.handleSignOut)
	r.Post("/forgot-password", s.handleForgotPassword)
	r.Post("/reset-password", s.handleResetPassword)

	r.Group(func(r chi.Router) {
		r.Use(s.requireSession)
		r.Get("/session", s.handleGetSession)
		r.Get("/sessions", s.handleListSessions)
		r.Post("/sessions/{id}/revoke", s.handleRevokeSession)
		r.Post("/sessions/revoke-others", s.handleRevokeOthers)
		r.Post("/change-password", s.handleChangePassword)
		r.Post("/change-email", s.handleChangeEmail)
		r.Patch("/user", s.handleUpdateUser)
		r.Post("/api-keys", s.handleCreateAPIKey)
		r.Get("/api-keys", s.handleListAPIKeys)
		r.Delete("/api-keys/{id}", s.handleDeleteAPIKey)
		r.Get("/passkeys", s.handleListPasskeys)
		r.Delete("/passkeys/{id}", s.handleDeletePasskey)
		r.Post("/passkey/register/begin", s.handlePasskeyRegisterBegin)
		r.Post("/passkey/register/finish", s.handlePasskeyRegisterFinish)
		r.Post("/passkey/auth/begin", s.handlePasskeyAuthBegin)
		r.Post("/passkey/auth/finish", s.handlePasskeyAuthFinish)
	})

	if s.cfg.OAuth != nil {
		r.Get("/oauth/{provider}", s.handleOAuthStart)
		r.Get("/oauth/{provider}/callback", s.handleOAuthCallback)
	}

	return r
}

func (s *Server) setSessionCookie(w http.ResponseWriter, signed string) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.CookieName,
		Value:    signed,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.store.Secure(),
	})
}

func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.store.Secure(),
		MaxAge:   -1,
	})
}

func (s *Server) signIn(w http.ResponseWriter, r *http.Request, user *auth.User) {
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}
	signed, _, err := s.store.CreateSession(r.Context(), user.ID, clientIP(r), r.UserAgent())
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}
	s.setSessionCookie(w, signed)
	writeJSON(w, http.StatusOK, map[string]any{"user": toAuthUser(user)})
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

// @Summary Sign in with email and password
// @Tags auth
// @Accept json
// @Produce json
// @Param body body signInRequest true "Credentials"
// @Success 200 {object} map[string]any
// @Router /api/auth/sign-in/email [post]
func (s *Server) handleSignInEmail(w http.ResponseWriter, r *http.Request) {
	var req signInRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}
	user, err := s.store.UserByEmail(r.Context(), req.Email)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to look up user")
		return
	}
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}
	ok, err := s.store.VerifyPassword(r.Context(), user.ID, req.Password)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to verify password")
		return
	}
	if !ok {
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}
	s.signIn(w, r, user)
}

type signInUsernameRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// @Summary Sign in with username and password
// @Tags auth
// @Accept json
// @Produce json
// @Param body body signInUsernameRequest true "Credentials"
// @Success 200 {object} map[string]any
// @Router /api/auth/sign-in/username [post]
func (s *Server) handleSignInUsername(w http.ResponseWriter, r *http.Request) {
	var req signInUsernameRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "username and password are required")
		return
	}
	user, err := s.store.UserByUsername(r.Context(), req.Username)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to look up user")
		return
	}
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}
	ok, err := s.store.VerifyPassword(r.Context(), user.ID, req.Password)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to verify password")
		return
	}
	if !ok {
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}
	s.signIn(w, r, user)
}

type usernameAvailableRequest struct {
	Username string `json:"username"`
}

func (s *Server) handleUsernameAvailable(w http.ResponseWriter, r *http.Request) {
	var req usernameAvailableRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	taken, err := s.store.UsernameTaken(r.Context(), req.Username)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to check username")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"available": !taken})
}

// @Summary Sign out the current session
// @Tags auth
// @Security SessionCookie
// @Success 200 {object} map[string]any
// @Router /api/auth/sign-out [post]
func (s *Server) handleSignOut(w http.ResponseWriter, r *http.Request) {
	if sess := SessionFrom(r.Context()); sess != nil {
		_ = s.store.RevokeSession(r.Context(), sess.UserID, sess.ID)
	} else if cookie, err := r.Cookie(auth.CookieName); err == nil {
		if token, ok := s.store.VerifySignature(cookie.Value); ok {
			_ = s.store.DeleteSessionByToken(r.Context(), token)
		}
	}
	s.clearSessionCookie(w)
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

// @Summary Get the current session
// @Tags auth
// @Security SessionCookie
// @Success 200 {object} map[string]any
// @Router /api/auth/session [get]
func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	user, sess := sessionAndUserFromRequest(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"session": authSessionResponse{
			ID:        sess.ID,
			ExpiresAt: sess.ExpiresAt,
			UserAgent: sess.UserAgent,
			IPAddress: sess.IPAddress,
			CreatedAt: sess.CreatedAt,
			IsCurrent: true,
		},
		"user": toAuthUser(user),
	})
}

func sessionAndUserFromRequest(r *http.Request) (*auth.User, *auth.Session) {
	return UserFrom(r.Context()), SessionFrom(r.Context())
}

func (s *Server) handleListSessions(w http.ResponseWriter, r *http.Request) {
	user, current := sessionAndUserFromRequest(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	sessions, err := s.store.ListSessions(r.Context(), user.ID)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to list sessions")
		return
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
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleRevokeSession(w http.ResponseWriter, r *http.Request) {
	user, _ := sessionAndUserFromRequest(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if err := s.store.RevokeSession(r.Context(), user.ID, id); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to revoke session")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *Server) handleRevokeOthers(w http.ResponseWriter, r *http.Request) {
	user, current := sessionAndUserFromRequest(r)
	if user == nil || current == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if err := s.store.RevokeOtherSessions(r.Context(), user.ID, current.ID); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to revoke sessions")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func (s *Server) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	user, _ := sessionAndUserFromRequest(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var req changePasswordRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.NewPassword == "" {
		writeError(w, http.StatusBadRequest, "new password is required")
		return
	}
	ok, err := s.store.VerifyPassword(r.Context(), user.ID, req.CurrentPassword)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to verify password")
		return
	}
	if !ok {
		writeError(w, http.StatusBadRequest, "current password is incorrect")
		return
	}
	if err := s.store.SetPassword(r.Context(), user.ID, req.NewPassword); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to change password")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

type changeEmailRequest struct {
	Email string `json:"email"`
}

func (s *Server) handleChangeEmail(w http.ResponseWriter, r *http.Request) {
	user, _ := sessionAndUserFromRequest(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var req changeEmailRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		writeError(w, http.StatusBadRequest, "invalid email")
		return
	}
	if err := s.store.ChangeEmail(r.Context(), user.ID, req.Email); err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "email already in use")
			return
		}
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to change email")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

type updateUserRequest struct {
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
}

func (s *Server) handleUpdateUser(w http.ResponseWriter, r *http.Request) {
	user, _ := sessionAndUserFromRequest(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var req updateUserRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := s.store.UpdateUser(r.Context(), user.ID, req.Name, req.Avatar); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to update user")
		return
	}
	updated, err := s.store.GetUserByID(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to reload user")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": toAuthUser(updated)})
}

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

func (s *Server) handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotPasswordRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	user, err := s.store.UserByEmail(r.Context(), req.Email)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to look up user")
		return
	}
	// Always return success to avoid user enumeration. Token is logged since
	// no SMTP is configured (parity with the original app).
	if user != nil {
		token, err := auth.GenerateResetToken()
		if err != nil {
			s.logError(r, err)
			writeError(w, http.StatusInternalServerError, "failed to generate token")
			return
		}
		if _, err := s.db.ExecContext(r.Context(),
			`INSERT INTO reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
			randid.New(), user.ID, auth.HashToken(token), time.Now().Add(time.Hour).UnixMilli(),
			time.Now().UnixMilli()); err != nil {
			s.logError(r, err)
			writeError(w, http.StatusInternalServerError, "failed to create reset token")
			return
		}
		slog.Warn("password reset token generated (no SMTP configured)", "email", user.Email, "token", token)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

type resetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

func (s *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetPasswordRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Token == "" || req.NewPassword == "" {
		writeError(w, http.StatusBadRequest, "token and new password are required")
		return
	}
	var userID string
	row := s.db.QueryRowContext(r.Context(),
		`SELECT user_id FROM reset_tokens WHERE token_hash = ? AND expires_at > ?`,
		auth.HashToken(req.Token), time.Now().UnixMilli())
	if err := row.Scan(&userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusBadRequest, "invalid or expired token")
			return
		}
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to look up token")
		return
	}
	if err := s.store.SetPassword(r.Context(), userID, req.NewPassword); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to reset password")
		return
	}
	if _, err := s.db.ExecContext(r.Context(),
		`DELETE FROM reset_tokens WHERE user_id = ?`, userID); err != nil {
		s.logError(r, err)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "unique")
}
