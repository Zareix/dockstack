package docker

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/client"
)

type Client struct {
	api        *client.Client
	httpClient *http.Client
	configDir  string
}

func NewClient(dockerHost, configDir string) (*Client, error) {
	opts := []client.Opt{}
	if dockerHost != "" {
		opts = append(opts, client.WithHost(dockerHost))
	}
	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, err
	}

	hc := &http.Client{Timeout: 30 * time.Second}
	socketPath, _ := strings.CutPrefix(dockerHost, "unix://")
	hc.Transport = &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", socketPath)
		},
	}
	return &Client{api: cli, httpClient: hc, configDir: configDir}, nil
}

func (c *Client) Ping(ctx context.Context) error {
	_, err := c.api.Ping(ctx)
	return err
}

func (c *Client) RemoteDigest(ctx context.Context, tag string) (string, bool) {
	auth := map[string]string{}
	if u, p, server, ok := c.RegistryAuth(tag); ok {
		auth = map[string]string{"username": u, "password": p, "serveraddress": server}
	}
	authJSON, _ := json.Marshal(auth)
	url := "http://docker/distribution/" + tag + "/json"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", false
	}
	req.Header.Set("X-Registry-Auth", base64.StdEncoding.EncodeToString(authJSON))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", false
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, resp.Body)
		return "", false
	}
	var data struct {
		Descriptor struct {
			Digest string `json:"digest"`
		} `json:"Descriptor"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", false
	}
	return data.Descriptor.Digest, true
}

func registryFromTag(tag string) string {
	parts := strings.Split(tag, "/")
	if len(parts) > 1 && (strings.Contains(parts[0], ".") || strings.Contains(parts[0], ":")) {
		return parts[0]
	}
	return "https://index.docker.io/v1/"
}

func (c *Client) RegistryAuth(tag string) (string, string, string, bool) {
	configPath := filepath.Join(c.configDir, "config.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return "", "", "", false
	}
	var cfg struct {
		Auths map[string]struct {
			Auth string `json:"auth"`
		} `json:"auths"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return "", "", "", false
	}
	registry := registryFromTag(tag)
	entry, ok := cfg.Auths[registry]
	if !ok || entry.Auth == "" {
		return "", "", "", false
	}
	decoded, err := base64.StdEncoding.DecodeString(entry.Auth)
	if err != nil {
		return "", "", "", false
	}
	parts := strings.SplitN(string(decoded), ":", 2)
	if len(parts) != 2 {
		return "", "", "", false
	}
	return parts[0], parts[1], registry, true
}
