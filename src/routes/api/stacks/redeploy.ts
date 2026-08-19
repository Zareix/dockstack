import { createFileRoute } from "@tanstack/react-router"

import { apiKeyMiddleware, loggingMiddleware } from "#/lib/middleware"
import { redeployQueue } from "#/lib/queue/redeploy-queue.ts"

export const Route = createFileRoute("/api/stacks/redeploy")({
  server: {
    middleware: [loggingMiddleware, apiKeyMiddleware],
    handlers: {
      POST: async () => {
        void redeployQueue.enqueueRedeploy().catch((error) => {
          console.error("Redeploy queue error", error)
        })
        return Response.json(
          {
            status: "queued",
            running: redeployQueue.isRedeployRunning(),
            queued: redeployQueue.redeployQueueSize(),
          },
          { status: 202 },
        )
      },
      GET: async () =>
        Response.json({
          running: redeployQueue.isRedeployRunning(),
          queued: redeployQueue.redeployQueueSize(),
        }),
    },
  },
})
