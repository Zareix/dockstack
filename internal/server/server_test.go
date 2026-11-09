package server

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/coder/websocket"
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
	t.Cleanup(func() { _ = sqlDB.Close() })
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
	store, err := auth.NewStore(cfg, sqlDB)
	if err != nil {
		t.Fatal(err)
	}
	srv, app, err := New(cfg, store)
	if err != nil {
		t.Fatal(err)
	}
	_ = app
	return srv, sqlDB
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

	if rr := doJSON(t, h, http.MethodGet, "/api/stacks", nil, nil); rr.Code != http.StatusUnauthorized {
		t.Fatalf("stacks without auth: %d", rr.Code)
	}
	if rr := doJSON(t, h, http.MethodGet, "/api/auth/session", nil, nil); rr.Code != http.StatusUnauthorized {
		t.Fatalf("session without auth: %d", rr.Code)
	}

	cookies := signInAsAdmin(t, h)
	if rr := doJSON(t, h, http.MethodGet, "/api/auth/session", nil, cookies); rr.Code != http.StatusOK {
		t.Fatalf("session with auth: %d %s", rr.Code, rr.Body.String())
	}

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

func TestSignInBruteForceLockout(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()

	fail := func(email string) *httptest.ResponseRecorder {
		return doJSON(t, h, http.MethodPost, "/api/auth/sign-in/email", map[string]string{
			"email": email, "password": "wrong",
		}, nil)
	}
	ok := func(email string) *httptest.ResponseRecorder {
		return doJSON(t, h, http.MethodPost, "/api/auth/sign-in/email", map[string]string{
			"email": email, "password": "password",
		}, nil)
	}

	// Matches signInIdentifierMaxFailures in the auth api package.
	for range 5 {
		if rr := fail("admin@example.com"); rr.Code != http.StatusUnauthorized {
			t.Fatalf("failed attempt: expected 401, got %d: %s", rr.Code, rr.Body.String())
		}
	}

	// The identifier is locked out: even correct credentials are rejected.
	rr := ok("admin@example.com")
	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("correct password after repeated failures: expected 429, got %d: %s", rr.Code, rr.Body.String())
	}
	if ra := rr.Header().Get("Retry-After"); ra == "" {
		t.Fatal("429 response missing Retry-After header")
	}

	// A different identifier from the same IP is not locked yet.
	if rr := fail("unknown@example.com"); rr.Code != http.StatusUnauthorized {
		t.Fatalf("other identifier: expected 401, got %d: %s", rr.Code, rr.Body.String())
	}

	// Matches signInIPMaxFailures in the auth api package: the isolation
	// attempt above counts as the 6th IP failure, so 4 more reach 10.
	for range 4 {
		if rr := fail("unknown@example.com"); rr.Code != http.StatusUnauthorized {
			t.Fatalf("ip failure: expected 401, got %d: %s", rr.Code, rr.Body.String())
		}
	}
	if rr := ok("admin@example.com"); rr.Code != http.StatusTooManyRequests {
		t.Fatalf("ip locked: expected 429, got %d: %s", rr.Code, rr.Body.String())
	}
	if rr := fail("fresh@example.com"); rr.Code != http.StatusTooManyRequests {
		t.Fatalf("fresh identifier from locked ip: expected 429, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSignInFailureCounterResetsOnSuccess(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()

	fail := func() *httptest.ResponseRecorder {
		return doJSON(t, h, http.MethodPost, "/api/auth/sign-in/email", map[string]string{
			"email": "admin@example.com", "password": "wrong",
		}, nil)
	}
	ok := func() *httptest.ResponseRecorder {
		return doJSON(t, h, http.MethodPost, "/api/auth/sign-in/email", map[string]string{
			"email": "admin@example.com", "password": "password",
		}, nil)
	}

	// Matches signInIdentifierMaxFailures in the auth api package.
	for range 4 {
		if rr := fail(); rr.Code != http.StatusUnauthorized {
			t.Fatalf("failed attempt: expected 401, got %d: %s", rr.Code, rr.Body.String())
		}
	}
	if rr := ok(); rr.Code != http.StatusOK {
		t.Fatalf("correct password below threshold: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	if rr := fail(); rr.Code != http.StatusUnauthorized {
		t.Fatalf("failed attempt after success: expected 401, got %d: %s", rr.Code, rr.Body.String())
	}
	// Without a reset this failure would accumulate on top of the earlier four
	// and the next sign-in would be locked out.
	if rr := ok(); rr.Code != http.StatusOK {
		t.Fatalf("counter should reset after success: expected 200, got %d: %s", rr.Code, rr.Body.String())
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

	req := httptest.NewRequest(http.MethodGet, "/api/stacks", nil)
	req.Header.Set("Authorization", "Bearer "+created.Key)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code == http.StatusUnauthorized {
		t.Fatalf("api key rejected: %s", rr.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/stacks", nil)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without key, got %d", rr.Code)
	}
}

func TestWebSocketAPIKeyAuth(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()
	cookies := signInAsAdmin(t, h)

	rr := doJSON(t, h, http.MethodPost, "/api/auth/api-keys", map[string]string{"name": "ws"}, cookies)
	if rr.Code != http.StatusOK {
		t.Fatalf("create key: %d %s", rr.Code, rr.Body.String())
	}
	var created struct {
		Key string `json:"key"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &created); err != nil || created.Key == "" {
		t.Fatalf("parse key: %v %s", err, rr.Body.String())
	}

	ts := httptest.NewServer(h)
	defer ts.Close()
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http")

	ctx := context.Background()
	if _, resp, err := websocket.Dial(ctx, wsURL+"/api/ws/logs", nil); err == nil || resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("ws without auth: err=%v status=%v", err, resp)
	}

	conn, resp, err := websocket.Dial(ctx, wsURL+"/api/ws/logs?token="+created.Key, nil)
	if err != nil {
		t.Fatalf("ws with api key: %v (status %v)", err, resp)
	}
	_ = conn.Close(websocket.StatusNormalClosure, "")
}

func TestContainerStatsAuth(t *testing.T) {
	srv, _ := newTestServer(t)
	rr := doJSON(t, srv.Handler(), http.MethodGet, "/api/containers/stats", nil, nil)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("container stats without auth: %d", rr.Code)
	}
}

func TestNetworkActions(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()

	if rr := doJSON(t, h, http.MethodPost, "/api/networks/prune", nil, nil); rr.Code != http.StatusUnauthorized {
		t.Fatalf("prune without auth: %d", rr.Code)
	}
	if rr := doJSON(t, h, http.MethodDelete, "/api/networks/app_net", nil, nil); rr.Code != http.StatusUnauthorized {
		t.Fatalf("remove without auth: %d", rr.Code)
	}

	cookies := signInAsAdmin(t, h)
	if rr := doJSON(t, h, http.MethodDelete, "/api/networks/bad!name", nil, cookies); rr.Code != http.StatusBadRequest {
		t.Fatalf("invalid name: %d %s", rr.Code, rr.Body.String())
	}
	if rr := doJSON(t, h, http.MethodPost, "/api/networks/prune", nil, cookies); rr.Code != http.StatusInternalServerError {
		t.Fatalf("prune with docker unavailable: %d %s", rr.Code, rr.Body.String())
	}
	if rr := doJSON(t, h, http.MethodDelete, "/api/networks/app_net", nil, cookies); rr.Code != http.StatusInternalServerError {
		t.Fatalf("remove with docker unavailable: %d %s", rr.Code, rr.Body.String())
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

func TestUpdateUser(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()
	cookies := signInAsAdmin(t, h)

	rr := doJSON(t, h, http.MethodPatch, "/api/auth/user", map[string]string{
		"name":     "New Name",
		"avatar":   "https://x/y.png",
		"username": "newname",
	}, cookies)
	if rr.Code != http.StatusOK {
		t.Fatalf("update user: %d %s", rr.Code, rr.Body.String())
	}
	if !bytes.Contains(rr.Body.Bytes(), []byte(`"username":"newname"`)) {
		t.Fatalf("username not updated: %s", rr.Body.String())
	}

	rr = doJSON(t, h, http.MethodPatch, "/api/auth/user", map[string]string{
		"name": "Other Name",
	}, cookies)
	if rr.Code != http.StatusOK {
		t.Fatalf("update without username: %d %s", rr.Code, rr.Body.String())
	}
	if !bytes.Contains(rr.Body.Bytes(), []byte(`"username":"newname"`)) {
		t.Fatalf("username should be unchanged: %s", rr.Body.String())
	}
	if !bytes.Contains(rr.Body.Bytes(), []byte(`"name":"Other Name"`)) {
		t.Fatalf("name not updated: %s", rr.Body.String())
	}

	rr = doJSON(t, h, http.MethodPatch, "/api/auth/user", map[string]any{
		"username": "",
	}, cookies)
	if rr.Code != http.StatusOK {
		t.Fatalf("empty username: %d %s", rr.Code, rr.Body.String())
	}
	if !bytes.Contains(rr.Body.Bytes(), []byte(`"username":"newname"`)) {
		t.Fatalf("empty username should not clear: %s", rr.Body.String())
	}

	rr = doJSON(t, h, http.MethodPatch, "/api/auth/user", map[string]string{
		"username": "bad name!",
	}, cookies)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("invalid username: %d %s", rr.Code, rr.Body.String())
	}
}

func TestStackRename(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()

	if rr := doJSON(t, h, http.MethodPost, "/api/stacks/old/rename", map[string]string{"name": "new"}, nil); rr.Code != http.StatusUnauthorized {
		t.Fatalf("rename without auth: %d", rr.Code)
	}

	cookies := signInAsAdmin(t, h)
	stacksDir := srv.deps().Stacks.Dir()
	oldDir := filepath.Join(stacksDir, "old")
	if err := os.MkdirAll(oldDir, 0o755); err != nil {
		t.Fatal(err)
	}

	rr := doJSON(t, h, http.MethodPost, "/api/stacks/old/rename", map[string]string{"name": "new"}, cookies)
	if rr.Code != http.StatusOK {
		t.Fatalf("rename: %d %s", rr.Code, rr.Body.String())
	}
	if _, err := os.Stat(filepath.Join(stacksDir, "new")); err != nil {
		t.Fatalf("new dir missing: %v", err)
	}
	if _, err := os.Stat(oldDir); !os.IsNotExist(err) {
		t.Fatalf("old dir should be gone: %v", err)
	}

	if rr := doJSON(t, h, http.MethodPost, "/api/stacks/missing/rename", map[string]string{"name": "other"}, cookies); rr.Code != http.StatusNotFound {
		t.Fatalf("rename missing stack: %d %s", rr.Code, rr.Body.String())
	}
	if rr := doJSON(t, h, http.MethodPost, "/api/stacks/new/rename", map[string]string{"name": "old!"}, cookies); rr.Code != http.StatusBadRequest {
		t.Fatalf("invalid new name: %d %s", rr.Code, rr.Body.String())
	}

	if err := os.MkdirAll(filepath.Join(stacksDir, "other"), 0o755); err != nil {
		t.Fatal(err)
	}
	if rr := doJSON(t, h, http.MethodPost, "/api/stacks/new/rename", map[string]string{"name": "other"}, cookies); rr.Code != http.StatusConflict {
		t.Fatalf("conflict: %d %s", rr.Code, rr.Body.String())
	}
}

func TestStackRedeploy(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()

	if rr := doJSON(t, h, http.MethodPost, "/api/stacks/app/redeploy", nil, nil); rr.Code != http.StatusUnauthorized {
		t.Fatalf("redeploy without auth: %d", rr.Code)
	}

	cookies := signInAsAdmin(t, h)
	stacksDir := srv.deps().Stacks.Dir()

	if rr := doJSON(t, h, http.MethodPost, "/api/stacks/bad.name/redeploy", nil, cookies); rr.Code != http.StatusBadRequest {
		t.Fatalf("invalid name: %d %s", rr.Code, rr.Body.String())
	}
	if rr := doJSON(t, h, http.MethodPost, "/api/stacks/missing/redeploy", nil, cookies); rr.Code != http.StatusNotFound {
		t.Fatalf("missing stack: %d %s", rr.Code, rr.Body.String())
	}

	if err := os.MkdirAll(filepath.Join(stacksDir, "excluded"), 0o755); err != nil {
		t.Fatal(err)
	}
	srv.deps().Cfg.RedeploySkip = []string{"excluded"}
	if rr := doJSON(t, h, http.MethodPost, "/api/stacks/excluded/redeploy", nil, cookies); rr.Code != http.StatusConflict {
		t.Fatalf("skipped stack: %d %s", rr.Code, rr.Body.String())
	}

	if err := os.MkdirAll(filepath.Join(stacksDir, "app"), 0o755); err != nil {
		t.Fatal(err)
	}
	rr := doJSON(t, h, http.MethodPost, "/api/stacks/app/redeploy", nil, cookies)
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("docker unavailable: %d %s", rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"error":"redeploy failed"`) {
		t.Fatalf("unexpected error body: %s", rr.Body.String())
	}

	rr = doJSON(t, h, http.MethodPost, "/api/auth/api-keys", map[string]string{"name": "ci"}, cookies)
	if rr.Code != http.StatusOK {
		t.Fatalf("create key: %d %s", rr.Code, rr.Body.String())
	}
	var created struct {
		Key string `json:"key"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &created); err != nil || created.Key == "" {
		t.Fatalf("parse key: %v %s", err, rr.Body.String())
	}
	req := httptest.NewRequest(http.MethodPost, "/api/stacks/missing/redeploy", nil)
	req.Header.Set("Authorization", "Bearer "+created.Key)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("api key redeploy: %d %s", rr.Code, rr.Body.String())
	}
}

func TestStacksRedeployGlobalRoute(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()

	cookies := signInAsAdmin(t, h)
	if rr := doJSON(t, h, http.MethodPost, "/api/stacks/redeploy", nil, cookies); rr.Code != http.StatusOK {
		t.Fatalf("global redeploy: %d %s", rr.Code, rr.Body.String())
	}
}

func TestStacksDrift(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()

	if rr := doJSON(t, h, http.MethodGet, "/api/stacks/drift", nil, nil); rr.Code != http.StatusUnauthorized {
		t.Fatalf("drift without auth: %d", rr.Code)
	}

	cookies := signInAsAdmin(t, h)
	rr := doJSON(t, h, http.MethodGet, "/api/stacks/drift", nil, cookies)
	if rr.Code != http.StatusOK {
		t.Fatalf("drift: %d %s", rr.Code, rr.Body.String())
	}
	if strings.TrimSpace(rr.Body.String()) != "{}" {
		t.Fatalf("empty stacks dir should return empty map, got: %s", rr.Body.String())
	}
}

func TestStackStreamGated(t *testing.T) {
	srv, _ := newTestServer(t)
	h := srv.Handler()

	if rr := doJSON(t, h, http.MethodPost, "/api/stacks/foo/up/stream", nil, nil); rr.Code != http.StatusUnauthorized {
		t.Fatalf("stream without auth: %d", rr.Code)
	}

	cookies := signInAsAdmin(t, h)
	req := httptest.NewRequest(http.MethodPost, "/api/stacks/foo/up/stream", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code == http.StatusUnauthorized {
		t.Fatalf("stream with auth rejected: %s", rr.Body.String())
	}
}

func TestStackValidateDraft(t *testing.T) {
	if _, err := exec.LookPath("docker"); err != nil {
		t.Skip("docker CLI not available")
	}
	if err := exec.Command("docker", "compose", "version").Run(); err != nil {
		t.Skip("docker compose not available")
	}

	srv, _ := newTestServer(t)
	h := srv.Handler()
	cookies := signInAsAdmin(t, h)

	stackDir := filepath.Join(srv.deps().Stacks.Dir(), "app")
	if err := os.MkdirAll(stackDir, 0o755); err != nil {
		t.Fatal(err)
	}
	rr := doJSON(t, h, http.MethodPost, "/api/stacks/app/validate", map[string]any{
		"compose": "services:\n  app:\n    image: alpine:${TAG:?tag required}\n",
		"env":     "TAG=3.20\n",
	}, cookies)
	if rr.Code != http.StatusOK {
		t.Fatalf("validate draft: %d %s", rr.Code, rr.Body.String())
	}
	var body struct {
		Validation struct {
			Valid  bool     `json:"valid"`
			Errors []string `json:"errors"`
		} `json:"validation"`
		Env struct {
			Used   []string `json:"used"`
			Unused []string `json:"unused"`
		} `json:"env"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if !body.Validation.Valid || len(body.Validation.Errors) != 0 {
		t.Fatalf("expected valid draft: %s", rr.Body.String())
	}
	if len(body.Env.Used) != 1 || body.Env.Used[0] != "TAG" {
		t.Fatalf("unexpected env usage: %s", rr.Body.String())
	}
	if _, err := os.Stat(filepath.Join(stackDir, "compose.yaml")); !os.IsNotExist(err) {
		t.Fatalf("draft validation should not write files: %v", err)
	}
}

func TestStackFilesSaveValidation(t *testing.T) {
	if _, err := exec.LookPath("docker"); err != nil {
		t.Skip("docker CLI not available")
	}
	if err := exec.Command("docker", "compose", "version").Run(); err != nil {
		t.Skip("docker compose not available")
	}

	srv, _ := newTestServer(t)
	h := srv.Handler()
	cookies := signInAsAdmin(t, h)

	if err := os.MkdirAll(filepath.Join(srv.deps().Stacks.Dir(), "app"), 0o755); err != nil {
		t.Fatal(err)
	}
	rr := doJSON(t, h, http.MethodPut, "/api/stacks/app/files", map[string]any{
		"composeFile": "compose.yaml",
		"compose":     "services:\n  app:\n    image: alpine\n   ports: ['80:80']\n",
	}, cookies)
	if rr.Code != http.StatusOK {
		t.Fatalf("save invalid compose: %d %s", rr.Code, rr.Body.String())
	}
	var body struct {
		Success     bool `json:"success"`
		Diagnostics struct {
			Validation struct {
				Valid            bool     `json:"valid"`
				Errors           []string `json:"errors"`
				Warnings         []string `json:"warnings"`
				ComposeAvailable bool     `json:"composeAvailable"`
			} `json:"validation"`
		} `json:"diagnostics"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if !body.Success {
		t.Fatalf("save should succeed: %s", rr.Body.String())
	}
	if !body.Diagnostics.Validation.ComposeAvailable {
		t.Fatalf("compose should be available: %s", rr.Body.String())
	}
	if body.Diagnostics.Validation.Valid {
		t.Fatalf("validation should fail: %s", rr.Body.String())
	}
	if len(body.Diagnostics.Validation.Errors) == 0 {
		t.Fatalf("expected validation errors: %s", rr.Body.String())
	}
}
