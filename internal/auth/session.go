package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
	"uuid"

	"github.com/go-webauthn/webauthn/webauthn"

	"github.com/zareix/dockstack/internal/config"
	"github.com/zareix/dockstack/internal/db/store"
)

const CookieName = "dockstack_session"

var ErrInvalidSession = errors.New("invalid session")

type User struct {
	ID            string
	Name          string
	Email         string
	EmailVerified bool
	Username      string
	Avatar        string
	Role          string
	CreatedAt     int64
	UpdatedAt     int64
}

type Session struct {
	ID             string
	UserID         string
	ExpiresAt      int64
	IPAddress      string
	UserAgent      string
	ImpersonatedBy *string
	CreatedAt      int64
}

type Store struct {
	q          *store.Queries
	secret     []byte
	secure     bool
	sessionTTL time.Duration
	wa         *webauthn.WebAuthn
}

func NewStore(cfg *config.Config, db *sql.DB) (*Store, error) {
	secure := strings.HasPrefix(strings.ToLower(cfg.AppURL), "https://")
	rpID, origin := webauthnParams(cfg)
	wa, err := webauthn.New(&webauthn.Config{
		RPDisplayName: cfg.AppTitle,
		RPID:          rpID,
		RPOrigins:     []string{origin},
	})
	if err != nil {
		return nil, err
	}
	return &Store{
		q:          store.New(db),
		secret:     []byte(cfg.AuthSecret),
		secure:     secure,
		sessionTTL: 7 * 24 * time.Hour,
		wa:         wa,
	}, nil
}

func webauthnParams(cfg *config.Config) (string, string) {
	if cfg.AppURL != "" {
		u, err := url.Parse(cfg.AppURL)
		if err == nil {
			return u.Hostname(), strings.TrimSuffix(cfg.AppURL, "/")
		}
	}
	return "localhost", "http://localhost:3000"
}

func userFromRow(u store.User) *User {
	user := &User{
		ID:            u.ID,
		Name:          u.Name,
		Email:         u.Email,
		EmailVerified: u.EmailVerified,
		Avatar:        u.Avatar,
		Role:          u.Role,
		CreatedAt:     u.CreatedAt,
		UpdatedAt:     u.UpdatedAt,
	}
	if u.Username != nil {
		user.Username = *u.Username
	}
	return user
}

func (s *Store) Secure() bool { return s.secure }

func (s *Store) SignToken(token string) string {
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(token))
	return token + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (s *Store) UnsafeParseToken(signed string) (string, error) {
	idx := strings.LastIndex(signed, ".")
	if idx < 0 {
		return "", ErrInvalidSession
	}
	return signed[:idx], nil
}

func (s *Store) VerifySignature(signed string) (string, bool) {
	token, err := s.UnsafeParseToken(signed)
	if err != nil {
		return "", false
	}
	expected := s.SignToken(token)
	return token, hmac.Equal([]byte(expected), []byte(signed))
}

func (s *Store) CreateSession(ctx context.Context, userID, ip, userAgent string) (string, *Session, error) {
	token, err := GenerateSessionToken()
	if err != nil {
		return "", nil, err
	}
	sess := &Session{
		ID:        uuid.New().String(),
		UserID:    userID,
		ExpiresAt: time.Now().Add(s.sessionTTL).UnixMilli(),
		IPAddress: ip,
		UserAgent: userAgent,
		CreatedAt: time.Now().UnixMilli(),
	}
	err = s.q.CreateSession(ctx, store.CreateSessionParams{
		ID:        sess.ID,
		UserID:    sess.UserID,
		TokenHash: HashToken(token),
		ExpiresAt: sess.ExpiresAt,
		IpAddress: sess.IPAddress,
		UserAgent: sess.UserAgent,
		CreatedAt: sess.CreatedAt,
	})
	if err != nil {
		return "", nil, fmt.Errorf("insert session: %w", err)
	}
	return s.SignToken(token), sess, nil
}

func (s *Store) SessionUserFromCookie(ctx context.Context, signed string) (*Session, *User, error) {
	token, ok := s.VerifySignature(signed)
	if !ok {
		return nil, nil, ErrInvalidSession
	}
	return s.sessionUser(ctx, token)
}

func (s *Store) sessionUser(ctx context.Context, token string) (*Session, *User, error) {
	row, err := s.q.GetSessionWithUserByTokenHash(ctx, HashToken(token))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, ErrInvalidSession
		}
		return nil, nil, err
	}
	sess := &Session{
		ID:        row.SessionID,
		UserID:    row.SessionUserID,
		ExpiresAt: row.ExpiresAt,
		IPAddress: row.IpAddress,
		UserAgent: row.UserAgent,
		CreatedAt: row.SessionCreatedAt,
	}
	if row.ImpersonatedBy != nil {
		sess.ImpersonatedBy = row.ImpersonatedBy
	}
	user := &User{
		ID:            row.UserID,
		Name:          row.UserName,
		Email:         row.UserEmail,
		EmailVerified: row.UserEmailVerified,
		Avatar:        row.UserAvatar,
		Role:          row.UserRole,
		CreatedAt:     row.UserCreatedAt,
		UpdatedAt:     row.UserUpdatedAt,
	}
	if row.UserUsername != nil {
		user.Username = *row.UserUsername
	}
	if time.Now().UnixMilli() > sess.ExpiresAt {
		return nil, nil, ErrInvalidSession
	}
	return sess, user, nil
}

func (s *Store) ListSessions(ctx context.Context, userID string) ([]Session, error) {
	rows, err := s.q.ListSessionsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	sessions := make([]Session, 0, len(rows))
	for _, r := range rows {
		sessions = append(sessions, Session{
			ID:             r.ID,
			UserID:         r.UserID,
			ExpiresAt:      r.ExpiresAt,
			IPAddress:      r.IpAddress,
			UserAgent:      r.UserAgent,
			ImpersonatedBy: r.ImpersonatedBy,
			CreatedAt:      r.CreatedAt,
		})
	}
	return sessions, nil
}

func (s *Store) RevokeSession(ctx context.Context, userID, sessionID string) error {
	return s.q.DeleteSession(ctx, store.DeleteSessionParams{ID: sessionID, UserID: userID})
}

func (s *Store) RevokeOtherSessions(ctx context.Context, userID, keepID string) error {
	return s.q.DeleteOtherSessions(ctx, store.DeleteOtherSessionsParams{UserID: userID, ID: keepID})
}

func (s *Store) RevokeAllSessions(ctx context.Context, userID string) error {
	return s.q.DeleteSessionsByUser(ctx, userID)
}

func (s *Store) DeleteSessionByToken(ctx context.Context, token string) error {
	return s.q.DeleteSessionByTokenHash(ctx, HashToken(token))
}

func (s *Store) DeleteExpired(ctx context.Context) error {
	return s.q.DeleteExpiredSessions(ctx, time.Now().UnixMilli())
}

func (s *Store) GetUserByID(ctx context.Context, id string) (*User, error) {
	row, err := s.q.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return userFromRow(row), nil
}

func (s *Store) UpdateUser(ctx context.Context, id, name, avatar string) error {
	var nameArg *string
	if name != "" {
		nameArg = &name
	}
	return s.q.UpdateUser(ctx, store.UpdateUserParams{
		Name:      nameArg,
		Avatar:    avatar,
		UpdatedAt: time.Now().UnixMilli(),
		ID:        id,
	})
}

func (s *Store) ChangeEmail(ctx context.Context, userID, email string) error {
	return s.q.ChangeUserEmail(ctx, store.ChangeUserEmailParams{
		Email:     email,
		UpdatedAt: time.Now().UnixMilli(),
		ID:        userID,
	})
}

func (s *Store) SetPassword(ctx context.Context, userID, password string) error {
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	return s.q.UpsertCredential(ctx, store.UpsertCredentialParams{
		UserID:       userID,
		PasswordHash: hash,
		UpdatedAt:    time.Now().UnixMilli(),
	})
}

func (s *Store) VerifyPassword(ctx context.Context, userID, password string) (bool, error) {
	row, err := s.q.GetCredential(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return VerifyPassword(password, row.PasswordHash)
}

func (s *Store) UserByEmail(ctx context.Context, email string) (*User, error) {
	row, err := s.q.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return userFromRow(row), nil
}

func (s *Store) UserByUsername(ctx context.Context, username string) (*User, error) {
	row, err := s.q.GetUserByUsername(ctx, &username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return userFromRow(row), nil
}

func (s *Store) UsernameTaken(ctx context.Context, username string) (bool, error) {
	count, err := s.q.UsernameTaken(ctx, &username)
	return count > 0, err
}
