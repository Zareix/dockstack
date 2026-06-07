import { createFileRoute } from '@tanstack/react-router'
import { apiKeyMiddleware } from '#/lib/auth/middleware'
import { redeployAllRunningStacks } from '#/lib/docker'

export const Route = createFileRoute('/api/stacks/redeploy')({
  server: {
    handlers: {
      middleware: [apiKeyMiddleware],
      POST: async () => {
        return Response.json(await redeployAllRunningStacks())
      },
    },
  },
})
