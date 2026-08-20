package config

import (
	"os"
	"testing"
)

func clearEnv() {
	for _, k := range []string{
		"APP_TITLE", "INSTANCE_NAME", "SERVER_HOST", "STACKS_DIR", "DATABASE_PATH",
		"DOCKER_CONFIG_DIR_PATH", "DOCKER_HOST", "APP_URL", "AUTH_SECRET", "ADMIN_EMAIL",
		"OTHER_INSTANCE_URLS", "OAUTH_PROVIDER_ID", "OAUTH_CLIENT_ID", "OAUTH_CLIENT_SECRET",
		"OAUTH_DISCOVERY_URL", "DOCKER_SYSTEM_PRUNE_CRON", "DOCKER_SYSTEM_PRUNE_INCLUDE_VOLUMES",
		"REDEPLOY_SKIP", "AUTODETECT_URL_BASE_DOMAIN",
	} {
		os.Unsetenv(k)
	}
}

func TestLoadDefaults(t *testing.T) {
	clearEnv()
	t.Setenv("ADMIN_EMAIL", "admin@example.com")
	t.Setenv("AUTH_SECRET", "secret")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.AppTitle != "Dockstack" {
		t.Errorf("AppTitle = %q", cfg.AppTitle)
	}
	if cfg.StacksDir != "./stacks" || cfg.DatabasePath != "./db.sqlite" {
		t.Errorf("paths: %+v", cfg)
	}
	if cfg.DockerHost != "unix:///var/run/docker.sock" {
		t.Errorf("DockerHost = %q", cfg.DockerHost)
	}
	if cfg.OAuth != nil {
		t.Error("OAuth should be nil without all vars")
	}
}

func TestLoadRequiresSecrets(t *testing.T) {
	clearEnv()
	if _, err := Load(); err == nil {
		t.Fatal("expected error without ADMIN_EMAIL/AUTH_SECRET")
	}
}

func TestLoadOtherInstances(t *testing.T) {
	clearEnv()
	t.Setenv("ADMIN_EMAIL", "admin@example.com")
	t.Setenv("AUTH_SECRET", "secret")
	t.Setenv("OTHER_INSTANCE_URLS", "Prod,https://a.example.com; Staging, https://b.example.com")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(cfg.OtherInstanceURLs) != 2 {
		t.Fatalf("instances = %+v", cfg.OtherInstanceURLs)
	}
	if cfg.OtherInstanceURLs[0] != (Instance{Title: "Prod", URL: "https://a.example.com"}) {
		t.Errorf("instance[0] = %+v", cfg.OtherInstanceURLs[0])
	}
	if cfg.OtherInstanceURLs[1].Title != "Staging" {
		t.Errorf("instance[1] = %+v", cfg.OtherInstanceURLs[1])
	}
}

func TestLoadOAuth(t *testing.T) {
	clearEnv()
	t.Setenv("ADMIN_EMAIL", "admin@example.com")
	t.Setenv("AUTH_SECRET", "secret")
	t.Setenv("OAUTH_PROVIDER_ID", "github")
	t.Setenv("OAUTH_CLIENT_ID", "id")
	t.Setenv("OAUTH_CLIENT_SECRET", "secret")
	t.Setenv("OAUTH_DISCOVERY_URL", "https://accounts.example.com/.well-known/openid-configuration")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if cfg.OAuth == nil || cfg.OAuth.ProviderID != "github" {
		t.Fatalf("oauth = %+v", cfg.OAuth)
	}
}

func TestLoadRedeploySkip(t *testing.T) {
	clearEnv()
	t.Setenv("ADMIN_EMAIL", "admin@example.com")
	t.Setenv("AUTH_SECRET", "secret")
	t.Setenv("REDEPLOY_SKIP", "traefik, proxy, ")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(cfg.RedeploySkip) != 2 || cfg.RedeploySkip[0] != "traefik" || cfg.RedeploySkip[1] != "proxy" {
		t.Fatalf("redeploy skip = %+v", cfg.RedeploySkip)
	}
}
