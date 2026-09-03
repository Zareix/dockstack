# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## What this is

Dockstack — a self-hosted Docker Compose stack management UI. Stacks are plain directories with a
`compose.yaml` (and `.env`) on disk; the app is stateless/local-first (SQLite is used only for auth).

**Backend**: Go (`cmd/dockstack` + `internal/`), a single static binary. It talks to the Docker
engine via the official SDK (`github.com/docker/docker/client`) and shells out to `docker compose`
for stack operations. Auth (sessions, API keys, passkeys, OAuth) is implemented in Go against a
clean SQLite schema (`modernc.org/sqlite`, embedded migrations). The built SPA is embedded via
`//go:embed internal/server/web-dist` (mirrored from `web/dist` at build time).

**Frontend**: `web/` is a TanStack Router + React **SPA** (Vite build, Bun tooling) that talks to the
Go REST/SSE/WS API via a typed fetch client (`web/src/lib/api/`). There is no SSR and no server
runtime in the frontend — all data comes from `/api/*`.

**Docs**: `wiki/` is a separate Fumadocs (Next.js) docs site with its own `package.json`, published
to https://zareix.github.io/dockstack/. It is listed in the root `package.json`'s `workspaces`
alongside `web`. Do not run root lint/format/test commands expecting them to cover `wiki/` — it has
its own toolchain.

## Commands

Backend (Go):

- `go run ./cmd/dockstack` — run the server (env vars required, see README)
- `go build ./cmd/dockstack` — build the binary
- `go test ./...` — run Go tests
- `go vet ./...` — static checks
- `just build` — build SPA into `internal/server/web-dist`, then compile the binary
- `just dev` — run backend + frontend dev servers in parallel

Frontend (run from repo root with bun, or from `web/`):

- `bun run web:dev` / `web:build` / `web:typecheck` — Vite dev (port 5173, proxies `/api` + WS to
  the Go server on :3000), production build, `tsc --noEmit`
- `bun run --filter dockstack-web lint` / `format` — oxlint / oxfmt scoped to `web/`

Wiki subproject (run from `wiki/`, or via root's `bun run wiki:dev` / `wiki:build`):

- `bun run dev` / `build` — Next.js dev/build
- `bun run types:check` — fumadocs-mdx codegen + Next typegen + `tsc --noEmit`

Always run `gofmt` (via `just lint` or `go vet`) and `go test ./...` before considering a Go change
done; for `web/**` use oxlint/oxfmt as CI expects.

## Architecture

**Routing (Go)**: `internal/server/` assembles a chi mux; the HTTP API itself lives in
`internal/server/api/` and is built with Huma (`github.com/danielgtaylor/huma/v2` + humachi
adapter). `api.Mount(router, deps)` registers everything; an OpenAPI 3.1 spec (with docs UI) is
generated at runtime and served publicly at `/api/openapi.json` / `/api/docs`. Public endpoints:
`/api/health`, `/api/settings`, `/api/auth/providers`. Auth endpoints under `/api/auth/*`
(sign-in, sessions, passkeys, OAuth, API keys). Session-gated resource API: `/api/stacks`,
`/api/containers`, `/api/images`, `/api/volumes`, `/api/networks`. Webhook (Bearer API key):
`GET /api/stacks/` and `POST /api/stacks/redeploy`. Stack actions also stream via SSE at
`/api/stacks/{name}/{action}/stream` (session-gated raw chi routes, not Huma ops). WebSockets
(session cookie or `?token=` API key): `/api/ws/exec` (container terminal, Docker exec hijack)
and `/api/ws/logs` (live stack logs). SPA assets are served from the embedded `web-dist`, with a
fallback to `index.html` for client routes.

**Docker layer** (`internal/docker/`): the engine client wrapper (`Client`), the Compose runner
(`Stacks` — `docker compose` subprocesses with env scrubbing and merged output streaming), logs
streaming, and the domain models (ContainerInfo, ImageInfo, VolumeInfo, NetworkInfo, StackStatus).
This is the only place that talks to the Docker socket or shells out to `docker compose`.

**API layer** (`internal/server/api/`): handlers receive an `api.Deps` struct (config, DB, auth
stores, docker clients) built by the server package. One file per domain
(auth, apikeys, passkeys, oauth, settings, stacks, resources, ws/exec/logs), each exposing its
own `registerXxx` route registration next to its handlers, so Huma operation metadata (summaries,
descriptions, tags) lives with the domain code. Auth is enforced per-operation via
`sessionMW`/`apiKeyMW` (Huma operation middlewares); raw chi routes (SSE, WS, OAuth redirects)
use conventional chi middleware. Response bodies are struct outputs with a `Body` field (Huma
requirement); errors keep the legacy `{"error": msg}` shape via a custom `huma.NewError`
override. `api.Version` is set from `cmd/dockstack/main.go` (`const Version`).

**Auth** (`internal/auth/`): sessions (signed cookies + token-hash rows), passwords (argon2id),
passkeys (`github.com/go-webauthn/webauthn`), API keys (SHA-256 stored, 100 req/min rate limit),
reset tokens. OAuth uses `golang.org/x/oauth2` + `coreos/go-oidc`. The DB schema lives in
`internal/db/migrations/*.sql` and runs at boot (`internal/db/db.go`); the admin user is seeded on
first run (`internal/db/seed.go`).

**Env vars**: validated in `internal/config/config.go` — add new env vars there, not via raw
`os.Getenv` reads elsewhere. See README for the full list.

**Frontend** (`web/`): TanStack Router file-based routes in `web/src/routes/`. `_private/route.tsx`
is a layout whose `beforeLoad` gates on a session fetch (`/api/auth/session`). `web/src/lib/api/`
holds the typed fetch client, SSE helper, and auth client. `web/src/lib/app-context/` provides
settings and session React contexts (split into `settings.tsx` and `session.tsx`). Do not create
barrel (`index.ts`) files that re-export multiple other files — import from the specific file
directly. UI components in `web/src/components/ui` are shadcn-generated
(base-ui primitives + `class-variance-authority`); treat them as vendored, prefer composing over
editing. Monaco (compose editor) and xterm (terminal) are client-only bundles.

## Security notes

- The compose runner scrubs app-specific env vars from child processes (see `getDockerEnv`).
- Stack names are validated against `^[a-zA-Z0-9_-]+$` before filesystem access.
- WebSocket endpoints require a session cookie or a Bearer API key (`?token=` query param).
- `/api/health`, `/api/settings`, and `/api/auth/providers` are intentionally public (pre-auth UI).
- The OpenAPI spec/docs (`/api/openapi.json`, `/api/docs`) are also public by design — they
  describe the API surface but grant no access.
