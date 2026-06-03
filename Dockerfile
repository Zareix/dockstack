FROM oven/bun:1.3.14 AS builder

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
RUN bun run build


FROM docker:29.5.2-cli AS docker-cli


FROM oven/bun:1.3.14-distroless AS runner

WORKDIR /app

COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/drizzle ./drizzle

ENV NODE_ENV=production
ENV PORT=3000
ENV STACKS_DIR=/app/stacks
ENV DATABASE_PATH=/app/data/db.sqlite

EXPOSE 3000

CMD ["./.output/server/index.mjs"]
