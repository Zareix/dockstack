package docker

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/client"
)

type remoteDigestEntry struct {
	digest string
	err    string
	at     time.Time
}

var errRegistryUnavailable = errors.New("registry lookup unavailable")

type Client struct {
	api        *client.Client
	httpClient *http.Client
	configDir  string

	digestMu sync.Mutex
	digests  map[string]remoteDigestEntry
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

func (c *Client) RemoteDigest(ctx context.Context, tag string) (string, bool) {
	digest, err := c.remoteDigest(ctx, tag)
	return digest, err == nil
}

func (c *Client) remoteDigest(ctx context.Context, image string) (string, error) {
	auth := map[string]string{}
	if u, p, server, ok := c.RegistryAuth(image); ok {
		auth = map[string]string{"username": u, "password": p, "serveraddress": server}
	}
	authJSON, _ := json.Marshal(auth)
	url := "http://docker/distribution/" + image + "/json"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("X-Registry-Auth", base64.StdEncoding.EncodeToString(authJSON))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: %v", errRegistryUnavailable, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4*1024))
		return "", registryError(resp.StatusCode, body)
	}
	var data struct {
		Descriptor struct {
			Digest string `json:"digest"`
		} `json:"Descriptor"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", fmt.Errorf("invalid registry response: %w", err)
	}
	if data.Descriptor.Digest == "" {
		return "", errors.New("registry returned an empty digest")
	}
	return data.Descriptor.Digest, nil
}

func registryError(status int, body []byte) error {
	var payload struct {
		Message string `json:"message"`
	}
	message := ""
	if json.Unmarshal(body, &payload) == nil {
		message = strings.Join(strings.Fields(payload.Message), " ")
	}
	switch status {
	case http.StatusNotFound:
		if message == "" {
			message = "not found"
		}
		return errors.New(message)
	case http.StatusUnauthorized, http.StatusForbidden:
		if message == "" {
			message = "unauthorized"
		}
		return errors.New(message)
	default:
		if message == "" {
			message = http.StatusText(status)
		}
		return fmt.Errorf("registry error: %s", message)
	}
}

const (
	remoteDigestTTL      = time.Hour
	imageResolveErrorTTL = 5 * time.Minute
)

func (c *Client) RemoteDigestCached(ctx context.Context, tag string) (string, bool) {
	c.digestMu.Lock()
	entry, ok := c.digests[tag]
	c.digestMu.Unlock()
	if ok && entry.err == "" && time.Since(entry.at) < remoteDigestTTL {
		return entry.digest, true
	}

	digest, ok := c.RemoteDigest(ctx, tag)
	if !ok {
		return "", false
	}

	c.digestMu.Lock()
	if c.digests == nil {
		c.digests = map[string]remoteDigestEntry{}
	}
	c.digests[tag] = remoteDigestEntry{digest: digest, at: time.Now()}
	c.digestMu.Unlock()
	return digest, true
}

func (c *Client) ResolveImage(ctx context.Context, image string) (string, error) {
	c.digestMu.Lock()
	entry, ok := c.digests[image]
	c.digestMu.Unlock()
	if ok {
		ttl := remoteDigestTTL
		if entry.err != "" {
			ttl = imageResolveErrorTTL
		}
		if time.Since(entry.at) < ttl {
			if entry.err != "" {
				return "", errors.New(entry.err)
			}
			return entry.digest, nil
		}
	}

	digest, err := c.remoteDigest(ctx, image)
	if err != nil && errors.Is(err, errRegistryUnavailable) {
		return "", err
	}

	entry = remoteDigestEntry{at: time.Now()}
	if err != nil {
		entry.err = err.Error()
	} else {
		entry.digest = digest
	}
	c.digestMu.Lock()
	if c.digests == nil {
		c.digests = map[string]remoteDigestEntry{}
	}
	c.digests[image] = entry
	c.digestMu.Unlock()
	return digest, err
}

func (c *Client) InvalidateRemoteDigests() {
	c.digestMu.Lock()
	c.digests = nil
	c.digestMu.Unlock()
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
