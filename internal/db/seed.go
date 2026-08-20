package db

import (
	"context"
	"database/sql"
	"log/slog"
	"time"

	"github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/randid"
)

func Seed(ctx context.Context, sqlDB *sql.DB, adminEmail string) error {
	var count int
	if err := sqlDB.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	hash, err := auth.HashPassword("password")
	if err != nil {
		return err
	}
	userID := randid.New()
	now := time.Now().UnixMilli()
	_, err = sqlDB.ExecContext(ctx, `
		INSERT INTO users (id, name, email, email_verified, username, role, created_at, updated_at)
		VALUES (?, 'Admin', ?, 1, 'admin', 'admin', ?, ?)`,
		userID, adminEmail, now, now)
	if err != nil {
		return err
	}
	_, err = sqlDB.ExecContext(ctx, `
		INSERT INTO credentials (user_id, password_hash, updated_at) VALUES (?, ?, ?)`,
		userID, hash, now)
	if err != nil {
		return err
	}
	slog.Warn("seeded admin user with default password \"password\" — change it after first login", "email", adminEmail)
	return nil
}
