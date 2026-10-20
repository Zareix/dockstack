package auth

import (
	"context"
	"database/sql"
	"testing"

	"github.com/zareix/dockstack/internal/config"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	schema := `
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    username TEXT UNIQUE,
    avatar TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE credentials (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    impersonated_by TEXT,
    created_at INTEGER NOT NULL
);
`
	if _, err := db.Exec(schema); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestSessionLifecycle(t *testing.T) {
	db := setupTestDB(t)
	ctx := context.Background()
	_, err := db.Exec("INSERT INTO users (id, name, email, role, created_at, updated_at) VALUES ('u1', 'Admin', 'a@b.c', 'admin', 0, 0)")
	if err != nil {
		t.Fatal(err)
	}
	s, err := NewStore(&config.Config{AuthSecret: "secret", AppURL: "http://localhost:3000"}, db)
	if err != nil {
		t.Fatal(err)
	}

	signed, sess, err := s.CreateSession(ctx, "u1", "127.0.0.1", "test-agent")
	if err != nil {
		t.Fatal(err)
	}
	if sess == nil || sess.ID == "" {
		t.Fatal("no session returned")
	}

	got, user, err := s.SessionUserFromCookie(ctx, signed)
	if err != nil {
		t.Fatalf("session from cookie: %v", err)
	}
	if user.ID != "u1" || got.UserID != "u1" {
		t.Fatalf("unexpected session user: %+v %+v", got, user)
	}

	if _, _, err := s.SessionUserFromCookie(ctx, signed+"tampered"); err == nil {
		t.Fatal("tampered cookie accepted")
	}

	if err := s.RevokeSession(ctx, "u1", sess.ID); err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.SessionUserFromCookie(ctx, signed); err == nil {
		t.Fatal("session still valid after revoke")
	}
}

func TestSessionUserByEmailAndUsername(t *testing.T) {
	db := setupTestDB(t)
	ctx := context.Background()
	_, err := db.Exec("INSERT INTO users (id, name, email, username, role, created_at, updated_at) VALUES ('u1', 'Admin', 'a@b.c', 'admin', 'admin', 0, 0)")
	if err != nil {
		t.Fatal(err)
	}
	s, err := NewStore(&config.Config{AuthSecret: "secret", AppURL: "http://localhost:3000"}, db)
	if err != nil {
		t.Fatal(err)
	}

	byEmail, err := s.UserByEmail(ctx, "a@b.c")
	if err != nil || byEmail == nil {
		t.Fatalf("by email: %v %v", byEmail, err)
	}
	byUser, err := s.UserByUsername(ctx, "admin")
	if err != nil || byUser == nil {
		t.Fatalf("by username: %v %v", byUser, err)
	}
	taken, err := s.UsernameTaken(ctx, "admin")
	if err != nil || !taken {
		t.Fatalf("username taken: %v %v", taken, err)
	}
	taken, err = s.UsernameTaken(ctx, "nope")
	if err != nil || taken {
		t.Fatalf("username not taken: %v %v", taken, err)
	}
}

func TestSetAndVerifyPassword(t *testing.T) {
	db := setupTestDB(t)
	ctx := context.Background()
	_, err := db.Exec("INSERT INTO users (id, name, email, role, created_at, updated_at) VALUES ('u1', 'Admin', 'a@b.c', 'admin', 0, 0)")
	if err != nil {
		t.Fatal(err)
	}
	s, err := NewStore(&config.Config{AuthSecret: "secret", AppURL: "http://localhost:3000"}, db)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SetPassword(ctx, "u1", "hunter2"); err != nil {
		t.Fatal(err)
	}
	ok, err := s.VerifyPassword(ctx, "u1", "hunter2")
	if err != nil || !ok {
		t.Fatalf("verify: ok=%v err=%v", ok, err)
	}
	ok, err = s.VerifyPassword(ctx, "u1", "wrong")
	if err != nil || ok {
		t.Fatalf("wrong password: ok=%v err=%v", ok, err)
	}
}

func TestSignTokenRoundTrip(t *testing.T) {
	s, err := NewStore(&config.Config{AuthSecret: "secret", AppURL: "http://localhost:3000"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	signed := s.SignToken("abc123")
	token, ok := s.VerifySignature(signed)
	if !ok || token != "abc123" {
		t.Fatalf("round trip: token=%q ok=%v", token, ok)
	}
	if _, ok := s.VerifySignature("abc123"); ok {
		t.Fatal("unsigned value accepted")
	}
	if _, ok := s.VerifySignature("abc123.bad"); ok {
		t.Fatal("bad signature accepted")
	}
}
