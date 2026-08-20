# ---- Stage 1: build the SPA ----
FROM oven/bun:1.3.14 AS web-builder

WORKDIR /app/web
COPY web/package.json web/bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY web/ .
RUN bun run build

# ---- Stage 2: build the Go binary (embeds the SPA) ----
FROM golang:1.26-alpine AS go-builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Mirror the built SPA into the embed location.
RUN rm -rf internal/server/web-dist && cp -R web/dist internal/server/web-dist
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/dockstack ./cmd/dockstack

# ---- Stage 3: runtime ----
FROM docker:29.7.0-cli AS docker-cli

FROM alpine:3.21 AS runner

WORKDIR /app

COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx

COPY --from=go-builder /out/dockstack /usr/local/bin/dockstack

ENV PORT=3000
ENV STACKS_DIR=/app/stacks
ENV DATABASE_PATH=/app/data/db.sqlite
ENV DOCKER_CONFIG_DIR_PATH=/app/.docker
ENV HOME=/app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=2s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["dockstack"]