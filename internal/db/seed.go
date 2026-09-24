package db

import (
	"context"
	"database/sql"
	"log/slog"
	"time"
	"uuid"

	"github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/db/store"
)

func Seed(ctx context.Context, sqlDB *sql.DB, adminEmail string) error {
	q := store.New(sqlDB)
	count, err := q.CountUsers(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	hash, err := auth.HashPassword("password")
	if err != nil {
		return err
	}
	userID := uuid.New().String()
	username := "admin"
	now := time.Now().UnixMilli()
	err = q.CreateUser(ctx, store.CreateUserParams{
		ID:            userID,
		Name:          "Admin",
		Email:         adminEmail,
		EmailVerified: true,
		Username:      &username,
		Role:          "admin",
		CreatedAt:     now,
		UpdatedAt:     now,
	})
	if err != nil {
		return err
	}
	err = q.UpsertCredential(ctx, store.UpsertCredentialParams{
		UserID:       userID,
		PasswordHash: hash,
		UpdatedAt:    now,
	})
	if err != nil {
		return err
	}
	slog.Warn("seeded admin user with default password \"password\" — change it after first login", "email", adminEmail)
	return nil
}
