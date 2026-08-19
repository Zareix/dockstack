import { createFileRoute } from "@tanstack/react-router"

import { apiKeyMiddleware, loggingMiddleware } from "#/lib/middleware"
import { redeployQueue } from "#/lib/queue.ts"

export const Route = createFileRoute("/api/stacks/redeploy")({
  server: {
    // middleware: [loggingMiddleware, apiKeyMiddleware],
    handlers: {
      POST: async () => {
        void redeployQueue.enqueueRedeploy().catch((error) => {
          console.error("Redeploy enqueue error", error)
        })
        const [running, queued] = await Promise.all([
          redeployQueue.isRunning(),
          redeployQueue.size(),
        ])
        return Response.json(
          {
            status: "queued",
            running,
            queued,
          },
          { status: 202 },
        )
      },
      GET: async () => {
        const [running, queued] = await Promise.all([
          redeployQueue.isRunning(),
          redeployQueue.size(),
        ])
        return Response.json({
          running,
          queued,
        })
      },
    },
  },
})
