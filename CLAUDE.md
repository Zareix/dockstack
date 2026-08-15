# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Dockstack — a self-hosted Docker Compose stack management UI. Stacks are plain directories with a
`compose.yaml` (and `.env`) on disk; the app is stateless/local-first (SQLite is used only for auth).
Built on Bun + TanStack Start (Vite + Nitro), talking to the Docker socket via `dockerode` /
`docker compose` under the hood.

This is a Bun workspace with **one nested project**: `wiki/` is a separate Fumadocs (Next.js) docs
site with its own `package.json`, published to https://zareix.github.io/dockstack/. It is listed in
the root `package.json`'s `workspaces`. Do not run root lint/format/test commands expecting them to
cover `wiki/` — it has its own toolchain (Next.js/TypeScript, no oxlint/oxfmt configured there).

## Commands

All commands below run from the repo root and use **bun**, not npm/pnpm/yarn.

- `bun run dev` — start the app (Vite dev server, port 3000)
- `bun run build` / `bun run preview` — production build / preview
- `bun test` — run tests (Bun's test runner)
- `bun run lint` / `bun run lint:fix` — oxlint (type-aware; see `.oxlintrc.json`)
- `bun run format` / `bun run format:check` — oxfmt (see `.oxfmtrc.json`)
- `bun run check` — format + lint:fix, run this before considering a change done
- `bun run db:generate` — generate a drizzle migration after editing `src/db/schema/*`
- `bun run auth:generate` — regenerate `src/db/schema/auth-schema.ts` from the better-auth config
- `bun run openapi:generate` — regenerate `wiki/openapi.yaml` from the API route tree

Wiki subproject (run from `wiki/`, or via root's `bun run wiki:dev` / `wiki:build`):

- `bun run dev` / `build` — Next.js dev/build
- `bun run types:check` — fumadocs-mdx codegen + Next typegen + `tsc --noEmit`

Always use `bun run lint:fix` / `bun run format` (not editor auto-format) to validate changes in
`src/**` — that's what CI/the maintainer expects clean.

## Architecture

**Routing**: TanStack Router, file-based, in `src/routes/`. `_private/route.tsx` is a layout route
whose `beforeLoad` calls `ensureSession` and redirects to `/auth/$path` when unauthenticated — every
route under `src/routes/_private/` is gated by this. `src/routes/api/**` are server routes (REST +
two WebSocket endpoints under `api/ws/` for the container terminal (`exec.ts`, hijacks the Docker
exec HTTP upgrade directly over the socket) and live log streaming (`logs.ts`)).

**Server functions layer** (`src/lib/functions/*`): one file per domain (stacks, containers, images,
volumes, networks, logs, settings, auth, files). Each exported function is a TanStack Start
`createServerFn()` with a `valibot` `.validator()` for input and `.middleware([authMiddleware])` for
auth — this is the only layer client components should import from for server calls. Components never
call `src/lib/docker/*` directly.

**Docker layer** (`src/lib/docker/*`): the actual `dockerode` / compose-on-disk logic, mirrored
one-to-one with the functions layer (`docker/stacks.ts` backs `functions/stacks.ts`, etc.), plus
`client.ts` (the shared `dockerode` client) and `system.ts`. This is the only place that talks to the
Docker socket or shells out to `docker compose`.

**Auth**: `src/lib/auth/index.ts` configures `better-auth` (drizzle/SQLite adapter) with plugins for
admin, username/passkey login, API keys, and optional generic OAuth (enabled only when
`OAUTH_PROVIDER_ID`/`OAUTH_CLIENT_ID` env vars are set). `src/lib/middleware.ts` has the
`authMiddleware` (session-gated) and `apiKeyMiddleware` (Bearer API key, used by the webhook redeploy
endpoint) used across server functions/routes.

**Env vars**: all validated centrally in `src/env.ts` via `@t3-oss/env-core` + valibot — add new env
vars there, not via raw `process.env` reads elsewhere.

**DB**: Drizzle + SQLite, schema in `src/db/schema/`. `auth-schema.ts` is generated (see
`auth:generate` above) — don't hand-edit it, change the better-auth config instead and regenerate.

**Editor**: `src/components/editor/monaco-file-editor.tsx` wraps `@monaco-editor/react` with
`monaco-yaml` for compose-file schema validation (schema fetched from the compose-spec repo). Monaco
workers are excluded from Nitro's server bundle (see `vite.config.ts` `rollupConfig.external`) since
they're client-only.

**Terminal**: `src/components/terminal` (xterm.js) talks to `api/ws/exec.ts` over WebSocket; only
shells in `AUTHORIZED_SHELLS` (`exec.ts`) may be requested.

**UI components**: `src/components/ui` is shadcn-generated (base-ui primitives + `class-variance-authority`).
`src/components/auth` builds on `@better-auth-ui/react` (sign-in/sign-up, settings, provider buttons,
etc. wrap that library's components rather than hand-rolled forms). Both directories are excluded from
oxlint (see `.oxlintrc.json` `ignorePatterns`) — treat them as vendored, prefer composing over editing.
