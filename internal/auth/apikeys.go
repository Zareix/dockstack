package auth

import (
	"context"
	"database/sql"
	"errors"
	"time"
	"uuid"
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

type NewAPIKey struct {
	UserID    string
	Name      string
	KeyHash   string
	ExpiresAt *int64
}

func (s *Store) CreateAPIKey(ctx context.Context, in NewAPIKey) (*APIKey, error) {
	now := time.Now().UnixMilli()
	key := &APIKey{
		ID:        uuid.New().String(),
		UserID:    in.UserID,
		Name:      in.Name,
		KeyHash:   in.KeyHash,
		Enabled:   true,
		ExpiresAt: in.ExpiresAt,
		CreatedAt: now,
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO api_keys (id, user_id, name, key_hash, enabled, expires_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
		key.ID, key.UserID, key.Name, key.KeyHash, key.ExpiresAt, now, now)
	if err != nil {
		return nil, err
	}
	return key, nil
}

func (s *Store) ListAPIKeys(ctx context.Context, userID string) ([]APIKey, error) {
	rows, err := s.db.QueryContext(ctx,
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

func (s *Store) DeleteAPIKey(ctx context.Context, userID, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM api_keys WHERE id = ? AND user_id = ?`, id, userID)
	return err
}

func (s *Store) VerifyKey(ctx context.Context, rawKey string) (*APIKey, error) {
	hash := HashToken(rawKey)
	row := s.db.QueryRowContext(ctx,
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

func (s *Store) RateLimit(ctx context.Context, keyID string, max int, windowMs int64) (bool, error) {
	now := time.Now().UnixMilli()
	res, err := s.db.ExecContext(ctx,
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
