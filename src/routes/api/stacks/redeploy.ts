import { createFileRoute } from '@tanstack/react-router'
import { apiKeyMiddleware, loggingMiddleware } from '#/lib/middleware'
import { redeployAllRunningStacks } from '#/lib/docker'

export const Route = createFileRoute('/api/stacks/redeploy')({
  server: {
    middleware: [loggingMiddleware, apiKeyMiddleware],
    handlers: {
      POST: async () => {
        return Response.json(await redeployAllRunningStacks())
      },
    },
  },
})
