# Dockstack

Self-hosted Docker Compose stack management UI. Browse, start, stop, restart, and redeploy your stacks from a web interface — no big database, no complex config.

## Features

- **Docker Compose first** — stacks are plain directories with a `compose.yaml` (and `.env`), managed on disk
- **Fast** — built on Bun + TanStack Start
- **Stateless and local-first** — SQLite used only for auth; stack state lives in Docker itself and on your filesystem
- **Built-in editor** — edit compose files directly in the UI with YAML validation
- **Webhook redeploy** — `POST /api/stacks/redeploy` with pulls and restarts all running services
- **OIDC / OAuth login** — any OpenID Connect provider (Pocket ID, Authentik, etc.)
- **Non-intrusive** — calls Docker socket or plain `docker compose` commands under the hood; fully compatible with manual CLI usage, no lock-in

## Wiki

Check out the wiki for setup instructions, environment variables, and more: https://zareix.github.io/dockstack/
