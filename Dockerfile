FROM oven/bun:1.3.14 AS builder

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
RUN bun run build


FROM docker:29.5.3-cli AS docker-cli


FROM oven/bun:1.3.14-distroless AS runner

WORKDIR /app

COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/drizzle ./drizzle

ENV NODE_ENV=production
ENV PORT=3000
ENV STACKS_DIR=/app/stacks
ENV DATABASE_PATH=/app/data/db.sqlite
ENV DOCKER_CONFIG_DIR_PATH=/app/docker
ENV BUILDX_CONFIG=/tmp/buildx

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=2s --retries=3 \
  CMD ["bun", "-e", "const r=await fetch('http://localhost:3000/api/health');process.exit(r.ok?0:1)"]

CMD ["./.output/server/index.mjs"]
