import { createFileRoute } from "@tanstack/react-router"

import { redeployAllRunningStacks } from "#/lib/docker"
import { apiKeyMiddleware, loggingMiddleware } from "#/lib/middleware"

export const Route = createFileRoute("/api/stacks/redeploy")({
  server: {
    middleware: [loggingMiddleware, apiKeyMiddleware],
    handlers: {
      POST: async () => {
        return Response.json(await redeployAllRunningStacks())
      },
    },
  },
})
