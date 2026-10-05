package auth

import (
	"context"
	"strings"
	"time"
	"uuid"

	"github.com/zareix/dockstack/internal/db/store"
)

func (s *Store) CreateResetToken(ctx context.Context, userID, tokenHash string, expiresAt int64) error {
	return s.q.InsertResetToken(ctx, store.InsertResetTokenParams{
		ID:        uuid.New().String(),
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now().UnixMilli(),
	})
}

func (s *Store) ActiveResetTokenUser(ctx context.Context, tokenHash string) (string, error) {
	row, err := s.q.GetActiveResetToken(ctx, store.GetActiveResetTokenParams{
		TokenHash: tokenHash,
		ExpiresAt: time.Now().UnixMilli(),
	})
	return row, err
}

func (s *Store) DeleteResetTokensByUser(ctx context.Context, userID string) error {
	return s.q.DeleteResetTokensByUser(ctx, userID)
}

func (s *Store) OAuthUserID(ctx context.Context, providerID, providerUserID string) (string, error) {
	row, err := s.q.GetOAuthAccountUser(ctx, store.GetOAuthAccountUserParams{
		ProviderID:     providerID,
		ProviderUserID: providerUserID,
	})
	return row, err
}

func (s *Store) CreateOAuthUser(ctx context.Context, email string) (*User, error) {
	id := uuid.New().String()
	now := time.Now().UnixMilli()
	err := s.q.CreateUser(ctx, store.CreateUserParams{
		ID:            id,
		Name:          strings.SplitN(email, "@", 2)[0],
		Email:         email,
		EmailVerified: true,
		CreatedAt:     now,
		UpdatedAt:     now,
	})
	if err != nil {
		return nil, err
	}
	return s.GetUserByID(ctx, id)
}

func (s *Store) LinkOAuthAccount(ctx context.Context, userID, providerID, providerUserID, email string) error {
	return s.q.InsertOAuthAccount(ctx, store.InsertOAuthAccountParams{
		ID:             uuid.New().String(),
		UserID:         userID,
		ProviderID:     providerID,
		ProviderUserID: providerUserID,
		Email:          email,
		CreatedAt:      time.Now().UnixMilli(),
	})
}
