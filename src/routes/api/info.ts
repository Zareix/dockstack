import { createFileRoute } from "@tanstack/react-router"

import { env } from "#/env.ts"

export const Route = createFileRoute("/api/info")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          title: env.APP_TITLE,
          url: env.BETTER_AUTH_URL,
        }),
    },
  },
})
