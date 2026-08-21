package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
	"uuid"
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
	db         *sql.DB
	secret     []byte
	secure     bool
	sessionTTL time.Duration
}

func NewStore(db *sql.DB, secret string, secure bool) *Store {
	return &Store{
		db:         db,
		secret:     []byte(secret),
		secure:     secure,
		sessionTTL: 7 * 24 * time.Hour,
	}
}

func (s *Store) Secure() bool { return s.secure }

// SignToken returns "<token>.<base64url(hmac-sha256(secret, token))>".
func (s *Store) SignToken(token string) string {
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(token))
	return token + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// UnsafeParseToken extracts the raw token from a signed value without verifying.
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
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		sess.ID, sess.UserID, HashToken(token), sess.ExpiresAt, sess.IPAddress, sess.UserAgent, sess.CreatedAt,
	)
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
	row := s.db.QueryRowContext(ctx,
		`SELECT s.id, s.user_id, s.expires_at, s.ip_address, s.user_agent, s.impersonated_by, s.created_at,
		        u.id, u.name, u.email, u.email_verified, u.username, u.avatar, u.role, u.created_at, u.updated_at
		 FROM sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.token_hash = ?`, HashToken(token))
	var sess Session
	var user User
	var imp sql.NullString
	var username sql.NullString
	if err := row.Scan(&sess.ID, &sess.UserID, &sess.ExpiresAt, &sess.IPAddress, &sess.UserAgent,
		&imp, &sess.CreatedAt,
		&user.ID, &user.Name, &user.Email, &user.EmailVerified, &username, &user.Avatar, &user.Role,
		&user.CreatedAt, &user.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, ErrInvalidSession
		}
		return nil, nil, err
	}
	if imp.Valid {
		sess.ImpersonatedBy = &imp.String
	}
	if username.Valid {
		user.Username = username.String
	}
	if time.Now().UnixMilli() > sess.ExpiresAt {
		return nil, nil, ErrInvalidSession
	}
	return &sess, &user, nil
}

func (s *Store) ListSessions(ctx context.Context, userID string) ([]Session, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, user_id, expires_at, ip_address, user_agent, impersonated_by, created_at
		 FROM sessions WHERE user_id = ? ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var sessions []Session
	for rows.Next() {
		var sess Session
		var imp sql.NullString
		if err := rows.Scan(&sess.ID, &sess.UserID, &sess.ExpiresAt, &sess.IPAddress, &sess.UserAgent,
			&imp, &sess.CreatedAt); err != nil {
			return nil, err
		}
		if imp.Valid {
			sess.ImpersonatedBy = &imp.String
		}
		sessions = append(sessions, sess)
	}
	return sessions, rows.Err()
}

func (s *Store) RevokeSession(ctx context.Context, userID, sessionID string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM sessions WHERE id = ? AND user_id = ?`, sessionID, userID)
	return err
}

func (s *Store) RevokeOtherSessions(ctx context.Context, userID, keepID string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM sessions WHERE user_id = ? AND id != ?`, userID, keepID)
	return err
}

func (s *Store) RevokeAllSessions(ctx context.Context, userID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE user_id = ?`, userID)
	return err
}

func (s *Store) DeleteSessionByToken(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, HashToken(token))
	return err
}

func (s *Store) DeleteExpired(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at < ?`, time.Now().UnixMilli())
	return err
}

func (s *Store) GetUserByID(ctx context.Context, id string) (*User, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, name, email, email_verified, username, avatar, role, created_at, updated_at
		 FROM users WHERE id = ?`, id)
	var u User
	var username sql.NullString
	if err := row.Scan(&u.ID, &u.Name, &u.Email, &u.EmailVerified, &username, &u.Avatar, &u.Role,
		&u.CreatedAt, &u.UpdatedAt); err != nil {
		return nil, err
	}
	if username.Valid {
		u.Username = username.String
	}
	return &u, nil
}

func (s *Store) UpdateUser(ctx context.Context, id, name, avatar string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET name = COALESCE(NULLIF(?, ''), name), avatar = ?,
		 updated_at = ? WHERE id = ?`, name, avatar, time.Now().UnixMilli(), id)
	return err
}

func (s *Store) ChangeEmail(ctx context.Context, userID, email string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET email = ?, updated_at = ? WHERE id = ?`, email, time.Now().UnixMilli(), userID)
	return err
}

func (s *Store) SetPassword(ctx context.Context, userID, password string) error {
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO credentials (user_id, password_hash, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at`,
		userID, hash, time.Now().UnixMilli())
	return err
}

func (s *Store) VerifyPassword(ctx context.Context, userID, password string) (bool, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT password_hash FROM credentials WHERE user_id = ?`, userID)
	var hash string
	if err := row.Scan(&hash); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return VerifyPassword(password, hash)
}

func (s *Store) UserByEmail(ctx context.Context, email string) (*User, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, name, email, email_verified, username, avatar, role, created_at, updated_at
		 FROM users WHERE email = ?`, email)
	var u User
	var username sql.NullString
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.EmailVerified, &username, &u.Avatar, &u.Role,
		&u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if username.Valid {
		u.Username = username.String
	}
	return &u, nil
}

func (s *Store) UserByUsername(ctx context.Context, username string) (*User, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, name, email, email_verified, username, avatar, role, created_at, updated_at
		 FROM users WHERE username = ?`, username)
	var u User
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.EmailVerified, &u.Username, &u.Avatar, &u.Role,
		&u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (s *Store) UsernameTaken(ctx context.Context, username string) (bool, error) {
	var exists int
	err := s.db.QueryRowContext(ctx, `SELECT 1 FROM users WHERE username = ?`, username).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}
