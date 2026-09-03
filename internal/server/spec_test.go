package server

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestOpenAPISpecIncludesAllRoutes(t *testing.T) {
	srv, _ := newTestServer(t)
	rr := doJSON(t, srv.Handler(), http.MethodGet, "/api/openapi.json", nil, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("openapi: %d", rr.Code)
	}
	var spec struct {
		Paths map[string]any `json:"paths"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &spec); err != nil {
		t.Fatal(err)
	}
	want := []string{
		"/api/health", "/api/settings", "/api/auth/providers",
		"/api/auth/sign-in/email", "/api/auth/session", "/api/auth/api-keys",
		"/api/stacks", "/api/stacks/{name}", "/api/stacks/{name}/up",
		"/api/stacks/redeploy", "/api/containers", "/api/images", "/api/volumes", "/api/networks",
	}
	for _, p := range want {
		if _, ok := spec.Paths[p]; !ok {
			t.Errorf("missing path in spec: %s", p)
		}
	}
	t.Logf("spec has %d paths", len(spec.Paths))
}
