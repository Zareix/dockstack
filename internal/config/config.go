package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	AppTitle        string
	InstanceName    string
	ServerHost      string
	StacksDir       string
	DatabasePath    string
	DockerConfigDir string
	DockerHost      string

	AdminEmail string

	AppURL     string
	AuthSecret string

	OtherInstanceURLs []Instance
	OAuth             *OAuthConfig

	DockerSystemPruneCron           string
	DockerSystemPruneIncludeVolumes bool

	RedeploySkip []string

	AutodetectURLBaseDomain string
}

type Instance struct {
	Title string
	URL   string
}

type OAuthConfig struct {
	ProviderID   string
	ClientID     string
	ClientSecret string
	DiscoveryURL string
}

func LoadDotEnv() error {
	err := godotenv.Load()
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getenvBool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

func Load() (*Config, error) {
	cfg := &Config{
		AppTitle:        getenv("APP_TITLE", "Dockstack"),
		InstanceName:    getenv("INSTANCE_NAME", ""),
		ServerHost:      getenv("SERVER_HOST", "localhost"),
		StacksDir:       getenv("STACKS_DIR", "./stacks"),
		DatabasePath:    getenv("DATABASE_PATH", "./db.sqlite"),
		DockerConfigDir: getenv("DOCKER_CONFIG_DIR_PATH", "./.docker"),
		DockerHost:      getenv("DOCKER_HOST", "unix:///var/run/docker.sock"),

		AdminEmail: os.Getenv("ADMIN_EMAIL"),

		AppURL:     getenv("APP_URL", ""),
		AuthSecret: os.Getenv("AUTH_SECRET"),

		DockerSystemPruneCron:           os.Getenv("DOCKER_SYSTEM_PRUNE_CRON"),
		DockerSystemPruneIncludeVolumes: getenvBool("DOCKER_SYSTEM_PRUNE_INCLUDE_VOLUMES", false),

		AutodetectURLBaseDomain: os.Getenv("AUTODETECT_URL_BASE_DOMAIN"),
	}

	if cfg.AdminEmail == "" {
		return nil, fmt.Errorf("ADMIN_EMAIL is required")
	}

	if cfg.AuthSecret == "" {
		return nil, fmt.Errorf("AUTH_SECRET is required")
	}

	// OTHER_INSTANCE_URLS: "title,url;title,url"
	if v := os.Getenv("OTHER_INSTANCE_URLS"); v != "" {
		for _, entry := range strings.Split(v, ";") {
			parts := strings.Split(strings.TrimSpace(entry), ",")
			if len(parts) != 2 {
				return nil, fmt.Errorf("invalid OTHER_INSTANCE_URLS entry %q: expected \"title,url\"", entry)
			}
			cfg.OtherInstanceURLs = append(cfg.OtherInstanceURLs, Instance{
				Title: strings.TrimSpace(parts[0]),
				URL:   strings.TrimSpace(parts[1]),
			})
		}
	}

	if id, cid, secret, disc :=
		os.Getenv("OAUTH_PROVIDER_ID"),
		os.Getenv("OAUTH_CLIENT_ID"),
		os.Getenv("OAUTH_CLIENT_SECRET"),
		os.Getenv("OAUTH_DISCOVERY_URL"); id != "" && cid != "" && secret != "" && disc != "" {
		cfg.OAuth = &OAuthConfig{
			ProviderID:   id,
			ClientID:     cid,
			ClientSecret: secret,
			DiscoveryURL: disc,
		}
	}

	if v := os.Getenv("REDEPLOY_SKIP"); v != "" {
		for _, s := range strings.Split(v, ",") {
			if s = strings.TrimSpace(s); s != "" {
				cfg.RedeploySkip = append(cfg.RedeploySkip, s)
			}
		}
	}

	return cfg, nil
}
