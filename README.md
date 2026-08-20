# Dockstack

Self-hosted Docker Compose stack management UI. Browse, edit, start, stop, restart, and redeploy your stacks from a web interface — no big database, no complex config.

## Features

- **Docker Compose first** — stacks are plain directories with a `compose.yaml` (and `.env`), managed on disk
- **Fast & self-contained** — a single Go binary that embeds the SPA frontend and serves the API
- **Stateless and local-first** — SQLite used only for auth; stack state lives in Docker itself and on your filesystem
- **Built-in editor** — edit compose files directly in the UI with YAML validation
- **Webhook redeploy** — `POST /api/stacks/redeploy` pulls and restarts all running services (Bearer API key)
- **Auth** — email/username + password, passkeys (WebAuthn), OIDC / OAuth login, API keys
- **Terminal & live logs** — WebSocket-based container terminal and stack log streaming
- **Non-intrusive** — talks to the Docker socket via the official Docker SDK, shells out to `docker compose`; fully compatible with manual CLI usage, no lock-in

## Architecture

- **Backend** — Go (chi router) in `cmd/dockstack` + `internal/`. Talks to the Docker engine via `github.com/docker/docker/client`; Compose operations shell out to the `docker compose` plugin. Auth state lives in SQLite (`modernc.org/sqlite`), embedded migrations run at boot, an admin user is seeded on first run.
- **Frontend** — `web/` is a TanStack Router + React SPA (Vite build) that talks to the Go REST/SSE/WS API. Built output (`web/dist`) is embedded into the Go binary via `//go:embed`.
- **Docs** — `wiki/` is a separate Fumadocs (Next.js) site, published to https://zareix.github.io/dockstack/. Its `openapi.yaml` is generated from the Go handlers with `just openapi` (swag).

## Development

Prerequisites: Go 1.26+, Bun, `just`, and a Docker daemon (the docker socket path is controlled by `DOCKER_HOST`, default `unix:///var/run/docker.sock`).

```sh
# Run backend (port 3000) and frontend dev server (port 5173, proxies /api + WS to :3000) together
just dev
```

Build everything (SPA → embed → binary):

```sh
just build        # produces ./bin/dockstack
```

Run tests:

```sh
go test ./...
```

## Configuration

Environment variables (validated at boot):

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_EMAIL` | yes | — | Email of the seeded admin user (password: `password`, change after first login) |
| `AUTH_SECRET` | yes | — | Secret used to sign session cookies |
| `APP_URL` | no | request origin | Public URL of the app (used for secure cookies, OAuth redirects, WebAuthn RP ID) |
| `APP_TITLE` | no | `Dockstack` | App title shown in the UI |
| `INSTANCE_NAME` | no | — | Instance label shown next to the title |
| `SERVER_HOST` | no | `localhost` | Hostname used for rendered container port links |
| `STACKS_DIR` | no | `./stacks` | Directory containing stack folders |
| `DATABASE_PATH` | no | `./db.sqlite` | SQLite database path |
| `DOCKER_HOST` | no | `unix:///var/run/docker.sock` | Docker engine endpoint |
| `DOCKER_CONFIG_DIR_PATH` | no | `./.docker` | Docker config dir (registry auth for pulls) |
| `OTHER_INSTANCE_URLS` | no | — | `title,url;title,url` list of linked instances |
| `OAUTH_PROVIDER_ID` / `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` / `OAUTH_DISCOVERY_URL` | no | — | Enable generic OIDC login when all four are set |
| `DOCKER_SYSTEM_PRUNE_CRON` | no | — | Cron expression for periodic system prune |
| `DOCKER_SYSTEM_PRUNE_INCLUDE_VOLUMES` | no | `false` | Include volumes in the cron prune |
| `REDEPLOY_SKIP` | no | — | Comma-separated stack names skipped by the redeploy webhook |
| `AUTODETECT_URL_BASE_DOMAIN` | no | — | Base domain for auto-detecting container URLs from labels |

## Deployment

```sh
docker compose up -d --build
```

The Dockerfile builds the SPA, compiles the Go binary (with the SPA embedded), and ships it with the docker CLI + compose/buildx plugins.

## Wiki

Check out the wiki for setup instructions, environment variables, and more: https://zareix.github.io/dockstack/
