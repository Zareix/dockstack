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

## Setup

Mount your stacks directory and the Docker socket:

```yaml
# compose.yaml
services:
  dockstack:
    image: ghcr.io/raphaelgc/dockstack:latest # versioning is also available
    ports:
      - 3000:3000
    volumes:
      - ./stacks:/app/stacks # one subdirectory per stack
      - dockstack-db:/app/data # sqlite database for auth
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - BETTER_AUTH_SECRET=changeme
      - BETTER_AUTH_URL=https://dockstack.example.com
      - ADMIN_EMAIL=you@example.com # default password is 'password'
      # optional for OIDC/OAuth login
      - OAUTH_PROVIDER_ID=my-provider
      - OAUTH_CLIENT_ID=...
      - OAUTH_CLIENT_SECRET=...
      - OAUTH_DISCOVERY_URL=https://auth.example.com/.well-known/openid-configuration

volumes:
  dockstack-db:
```

Each stack is a subdirectory under `STACKS_DIR` containing a compose file:

```
stacks/
  my-app/
    compose.yaml
  another-service/
    compose.yaml
    .env
```

## Environment variables

| Variable              | Required | Default               | Description                                   |
| --------------------- | -------- | --------------------- | --------------------------------------------- |
| `BETTER_AUTH_SECRET`  | yes      | —                     | Secret key for session signing (min 32 chars) |
| `BETTER_AUTH_URL`     | yes      | —                     | Public URL of the dockstack instance          |
| `ADMIN_EMAIL`         | yes      | —                     | Email of the initial admin user               |
| `OAUTH_PROVIDER_ID`   | yes      | —                     | Display name for the OAuth provider           |
| `OAUTH_CLIENT_ID`     | yes      | —                     | OAuth client ID                               |
| `OAUTH_CLIENT_SECRET` | yes      | —                     | OAuth client secret                           |
| `OAUTH_DISCOVERY_URL` | yes      | —                     | OIDC discovery endpoint URL                   |
| `SERVER_HOST`         | no       | `localhost`           | Host shown in port links in the UI            |
| `STACKS_DIR`          | no       | `/app/stacks`         | Path to stacks directory inside container     |
| `DATABASE_PATH`       | no       | `/app/data/db.sqlite` | Path to SQLite auth database                  |
| `PORT`                | no       | `3000`                | HTTP port the server listens on               |

## Webhook redeploy

Trigger a pull + redeploy of all running stacks via API key:

```sh
curl -X POST https://dockstack.example.com/api/stacks/redeploy \
  -H "x-api-key: <your-api-key>"
```

Generate API keys from the settings page. Only running services in each stack are restarted — stopped services are left untouched.
