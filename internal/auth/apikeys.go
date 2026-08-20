package auth

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/zareix/dockstack/internal/randid"
)

type APIKey struct {
	ID        string
	UserID    string
	Name      string
	KeyHash   string
	Enabled   bool
	ExpiresAt *int64
	CreatedAt int64

	rateLimitMax    int
	rateLimitWindow int64
}

func (k *APIKey) RateLimitMax() int {
	if k.rateLimitMax <= 0 {
		return 100
	}
	return k.rateLimitMax
}

func (k *APIKey) RateLimitWindow() int64 {
	if k.rateLimitWindow <= 0 {
		return 60000
	}
	return k.rateLimitWindow
}

type APIKeyStore struct {
	db *sql.DB
}

func NewAPIKeyStore(db *sql.DB) *APIKeyStore {
	return &APIKeyStore{db: db}
}

type NewAPIKey struct {
	UserID    string
	Name      string
	KeyHash   string
	ExpiresAt *int64
}

func (k *APIKeyStore) Create(ctx context.Context, in NewAPIKey) (*APIKey, error) {
	now := time.Now().UnixMilli()
	key := &APIKey{
		ID:        randid.New(),
		UserID:    in.UserID,
		Name:      in.Name,
		KeyHash:   in.KeyHash,
		Enabled:   true,
		ExpiresAt: in.ExpiresAt,
		CreatedAt: now,
	}
	_, err := k.db.ExecContext(ctx,
		`INSERT INTO api_keys (id, user_id, name, key_hash, enabled, expires_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
		key.ID, key.UserID, key.Name, key.KeyHash, key.ExpiresAt, now, now)
	if err != nil {
		return nil, err
	}
	return key, nil
}

func (k *APIKeyStore) List(ctx context.Context, userID string) ([]APIKey, error) {
	rows, err := k.db.QueryContext(ctx,
		`SELECT id, user_id, name, key_hash, enabled, expires_at, created_at,
		        rate_limit_max, rate_limit_window
		 FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var keys []APIKey
	for rows.Next() {
		var key APIKey
		var exp sql.NullInt64
		if err := rows.Scan(&key.ID, &key.UserID, &key.Name, &key.KeyHash, &key.Enabled, &exp,
			&key.CreatedAt, &key.rateLimitMax, &key.rateLimitWindow); err != nil {
			return nil, err
		}
		if exp.Valid {
			key.ExpiresAt = &exp.Int64
		}
		keys = append(keys, key)
	}
	return keys, rows.Err()
}

func (k *APIKeyStore) Delete(ctx context.Context, userID, id string) error {
	_, err := k.db.ExecContext(ctx, `DELETE FROM api_keys WHERE id = ? AND user_id = ?`, id, userID)
	return err
}

// VerifyKey looks up a key by its raw value's hash and returns the owning user.
// It enforces enabled state and expiry.
func (k *APIKeyStore) VerifyKey(ctx context.Context, rawKey string) (*APIKey, error) {
	hash := HashToken(rawKey)
	row := k.db.QueryRowContext(ctx,
		`SELECT id, user_id, name, key_hash, enabled, expires_at, created_at,
		        rate_limit_max, rate_limit_window
		 FROM api_keys WHERE key_hash = ?`, hash)
	var key APIKey
	var exp sql.NullInt64
	if err := row.Scan(&key.ID, &key.UserID, &key.Name, &key.KeyHash, &key.Enabled, &exp,
		&key.CreatedAt, &key.rateLimitMax, &key.rateLimitWindow); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("invalid API key")
		}
		return nil, err
	}
	if exp.Valid {
		key.ExpiresAt = &exp.Int64
	}
	if !key.Enabled {
		return nil, errors.New("API key is disabled")
	}
	if key.ExpiresAt != nil && time.Now().UnixMilli() > *key.ExpiresAt {
		return nil, errors.New("API key has expired")
	}
	return &key, nil
}

// RateLimit checks and records a request against the key's 100 req/min window.
func (k *APIKeyStore) RateLimit(ctx context.Context, keyID string, max int, windowMs int64) (bool, error) {
	now := time.Now().UnixMilli()
	res, err := k.db.ExecContext(ctx,
		`UPDATE api_keys
		 SET request_count = CASE
		     WHEN last_request_at IS NULL OR last_request_at < ? THEN 1
		     ELSE request_count + 1
		 END,
		 last_request_at = ?
		 WHERE id = ? AND (
		   request_count < ? OR
		   last_request_at IS NULL OR last_request_at < ?
		 )`,
		now-windowMs, now, keyID, max, now-windowMs)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}
