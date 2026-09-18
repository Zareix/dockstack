package auth

import (
	"context"
	"database/sql"
	"errors"
	"time"
	"uuid"

	"github.com/zareix/dockstack/internal/db/store"
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

func apiKeyFromRow(r store.ApiKey) APIKey {
	key := APIKey{
		ID:              r.ID,
		UserID:          r.UserID,
		Name:            r.Name,
		KeyHash:         r.KeyHash,
		Enabled:         r.Enabled,
		ExpiresAt:       r.ExpiresAt,
		CreatedAt:       r.CreatedAt,
		rateLimitMax:    int(r.RateLimitMax),
		rateLimitWindow: r.RateLimitWindow,
	}
	return key
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
	err := s.q.CreateAPIKey(ctx, store.CreateAPIKeyParams{
		ID:        key.ID,
		UserID:    key.UserID,
		Name:      key.Name,
		KeyHash:   key.KeyHash,
		ExpiresAt: key.ExpiresAt,
		CreatedAt: now,
		UpdatedAt: now,
	})
	if err != nil {
		return nil, err
	}
	return key, nil
}

func (s *Store) ListAPIKeys(ctx context.Context, userID string) ([]APIKey, error) {
	rows, err := s.q.ListAPIKeysByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	keys := make([]APIKey, 0, len(rows))
	for _, r := range rows {
		keys = append(keys, apiKeyFromRow(r))
	}
	return keys, nil
}

func (s *Store) DeleteAPIKey(ctx context.Context, userID, id string) error {
	return s.q.DeleteAPIKey(ctx, store.DeleteAPIKeyParams{ID: id, UserID: userID})
}

func (s *Store) VerifyKey(ctx context.Context, rawKey string) (*APIKey, error) {
	row, err := s.q.GetAPIKeyByHash(ctx, HashToken(rawKey))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("invalid API key")
		}
		return nil, err
	}
	key := apiKeyFromRow(row)
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
	windowStart := now - windowMs
	n, err := s.q.UpdateAPIKeyRateLimit(ctx, store.UpdateAPIKeyRateLimitParams{
		WindowStart: &windowStart,
		Now:         &now,
		ID:          keyID,
		Max:         int64(max),
	})
	if err != nil {
		return false, err
	}
	return n > 0, nil
}
