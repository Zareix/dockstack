package server

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/config"
	"github.com/zareix/dockstack/internal/db"
)

func newTestServer(t *testing.T) (*Server, *sql.DB) {
	t.Helper()
	sqlDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	if err := db.Migrate(sqlDB); err != nil {
		t.Fatal(err)
	}
	if err := db.Seed(t.Context(), sqlDB, "admin@example.com"); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{
		AppTitle:   "Test",
		ServerHost: "localhost",
		StacksDir:  t.TempDir(),
		AuthSecret: "test-secret",
		AdminEmail: "admin@example.com",
		DockerHost: "unix:///nonexistent.sock",
		AppURL:     "",
	}
	app, err := NewApp(cfg)
	if err != nil {
		t.Fatal(err)
	}
	store := auth.NewStore(sqlDB, "test-secret", false)
	keys := auth.NewAPIKeyStore(sqlDB)
	passkeys, err := auth.NewPasskeyService(sqlDB, "localhost", "Test", "http://localhost:3000")
	if err != nil {
		t.Fatal(err)
	}
	return New(cfg, sqlDB, store, keys, passkeys, app), sqlDB
}

func doJSON(t *testing.T, h http.Handler, method, path string, body any, cookies []*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

func signInAsAdmin(t *testing.T, h http.Handler) []*http.Cookie {
	t.Helper()
	rr := doJSON(t, h, http.MethodPost, "/api/auth/sign-in/email", map[string]string{
		"email": "admin@example.com", "password": "password",
	}, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("sign in: %d %s", rr.Code, rr.Body.String())
	}
	return rr.Result().Cookies()
}

func TestHealthPublic(t *testing.T) {
	srv, _ := newTestServer(t)
	rr := doJSON(t, srv.Handler(), http.MethodGet, "/api/health", nil, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("health: %d", rr.Code)
	}
}

func TestSettingsPublic(t *testing.T) {
	srv, _ := newTestServer(t)
	rr := doJSON(t, srv.Handler(), http.MethodGet, "/api/settings", nil, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("settings: %d", rr.Code)
	}
	if !bytes.Contains(rr.Body.Bytes(), []byte(`"appTitle":"Test"`)) {
		t.Fatalf("settings body: %s", rr.Body.String())
	}
}

func TestSessionGating(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()

	// Unauthenticated requests are rejected.
	if rr := doJSON(t, h, http.MethodGet, "/api/stacks", nil, nil); rr.Code != http.StatusUnauthorized {
		t.Fatalf("stacks without auth: %d", rr.Code)
	}
	if rr := doJSON(t, h, http.MethodGet, "/api/auth/session", nil, nil); rr.Code != http.StatusUnauthorized {
		t.Fatalf("session without auth: %d", rr.Code)
	}

	// Sign in, then the same endpoints work.
	cookies := signInAsAdmin(t, h)
	if rr := doJSON(t, h, http.MethodGet, "/api/auth/session", nil, cookies); rr.Code != http.StatusOK {
		t.Fatalf("session with auth: %d %s", rr.Code, rr.Body.String())
	}
	// /api/stacks will hit docker (unavailable in tests) — verify it's gated, not 401.
	// Docker is unreachable so we expect a 500 rather than 401.
	rr := doJSON(t, h, http.MethodGet, "/api/stacks", nil, cookies)
	if rr.Code == http.StatusUnauthorized {
		t.Fatalf("stacks still 401 with auth: %s", rr.Body.String())
	}
}

func TestSignInWrongPassword(t *testing.T) {
	srv, _ := newTestServer(t)
	rr := doJSON(t, srv.Handler(), http.MethodPost, "/api/auth/sign-in/email", map[string]string{
		"email": "admin@example.com", "password": "wrong",
	}, nil)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestAPIKeyAuth(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()

	cookies := signInAsAdmin(t, h)
	rr := doJSON(t, h, http.MethodPost, "/api/auth/api-keys", map[string]string{"name": "ci"}, cookies)
	if rr.Code != http.StatusOK {
		t.Fatalf("create key: %d %s", rr.Code, rr.Body.String())
	}
	var created struct {
		Key string `json:"key"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &created); err != nil || created.Key == "" {
		t.Fatalf("parse key: %v %s", err, rr.Body.String())
	}

	req := httptest.NewRequest(http.MethodGet, "/api/stacks/", nil)
	req.Header.Set("Authorization", "Bearer "+created.Key)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	// Authenticated as API key — expect 500 (docker unreachable), not 401.
	if rr.Code == http.StatusUnauthorized {
		t.Fatalf("api key rejected: %s", rr.Body.String())
	}

	// No key -> 401.
	req = httptest.NewRequest(http.MethodGet, "/api/stacks/", nil)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without key, got %d", rr.Code)
	}
}

func TestSignOutRevokesSession(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()

	cookies := signInAsAdmin(t, h)
	if rr := doJSON(t, h, http.MethodPost, "/api/auth/sign-out", nil, cookies); rr.Code != http.StatusOK {
		t.Fatalf("sign out: %d", rr.Code)
	}
	if rr := doJSON(t, h, http.MethodGet, "/api/auth/session", nil, cookies); rr.Code != http.StatusUnauthorized {
		t.Fatalf("session after sign out: %d", rr.Code)
	}
}
