package auth

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/zareix/dockstack/internal/config"
	"github.com/zareix/dockstack/internal/db/store"

	_ "modernc.org/sqlite"
)

func setupCleanupDB(t *testing.T) *Store {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	schema := `
CREATE TABLE webauthn_challenges (
    id         TEXT PRIMARY KEY,
    challenge  TEXT NOT NULL,
    user_id    TEXT,
    kind       TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE TABLE reset_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
`
	if _, err := db.Exec(schema); err != nil {
		t.Fatal(err)
	}
	s, err := NewStore(&config.Config{AuthSecret: "secret", AppURL: "http://localhost:3000"}, db)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestDeleteExpiredChallenges(t *testing.T) {
	s := setupCleanupDB(t)
	ctx := context.Background()

	seed := func(id string, expiresAt int64) {
		err := s.q.InsertChallenge(ctx, store.InsertChallengeParams{
			ID:        id,
			Challenge: "{}",
			Kind:      "auth",
			ExpiresAt: expiresAt,
			CreatedAt: time.Now().UnixMilli(),
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	seed("expired", time.Now().Add(-time.Hour).UnixMilli())
	seed("live", time.Now().Add(time.Minute).UnixMilli())

	n, err := s.DeleteExpiredChallenges(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("expected 1 deleted challenge, got %d", n)
	}
	if _, err := s.q.GetChallenge(ctx, store.GetChallengeParams{
		ID:        "live",
		Kind:      "auth",
		ExpiresAt: time.Now().UnixMilli(),
	}); err != nil {
		t.Fatalf("live challenge should remain: %v", err)
	}
	if _, err := s.q.GetChallenge(ctx, store.GetChallengeParams{
		ID:        "expired",
		Kind:      "auth",
		ExpiresAt: time.Now().UnixMilli(),
	}); err == nil {
		t.Fatal("expired challenge should have been deleted")
	}
}

func TestDeleteExpiredResetTokens(t *testing.T) {
	s := setupCleanupDB(t)
	ctx := context.Background()

	seed := func(hash string, expiresAt int64) {
		if err := s.CreateResetToken(ctx, "u1", hash, expiresAt); err != nil {
			t.Fatal(err)
		}
	}
	seed("hash-expired", time.Now().Add(-time.Hour).UnixMilli())
	seed("hash-live", time.Now().Add(time.Hour).UnixMilli())

	n, err := s.DeleteExpiredResetTokens(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("expected 1 deleted reset token, got %d", n)
	}
	if _, err := s.ActiveResetTokenUser(ctx, "hash-live"); err != nil {
		t.Fatalf("live token should remain: %v", err)
	}
	if _, err := s.ActiveResetTokenUser(ctx, "hash-expired"); err == nil {
		t.Fatal("expired token should have been deleted")
	}
}
