import { createFileRoute } from "@tanstack/react-router"

import { apiKeyMiddleware, loggingMiddleware } from "#/lib/middleware"
import { enqueueRedeploy, isRedeployRunning, redeployQueueSize } from "#/lib/redeploy-queue"

export const Route = createFileRoute("/api/stacks/redeploy")({
  server: {
    middleware: [loggingMiddleware, apiKeyMiddleware],
    handlers: {
      POST: async () => {
        // Fire-and-forget : le job est persisté (SQLite) et traité par le
        // worker bunqueue en arrière-plan.
        void enqueueRedeploy().catch((error) => {
          console.error("Redeploy enqueue error", error)
        })
        return Response.json(
          {
            status: "queued",
            running: await isRedeployRunning(),
            queued: await redeployQueueSize(),
          },
          { status: 202 },
        )
      },
      GET: async () =>
        Response.json({ running: await isRedeployRunning(), queued: await redeployQueueSize() }),
    },
  },
})
