import { createFileRoute } from '@tanstack/react-router'
import { apiKeyMiddleware } from '#/lib/auth/middleware'
import { listStacks } from '#/lib/functions'

export const Route = createFileRoute('/api/stacks')({
  server: {
    handlers: {
      middleware: [apiKeyMiddleware],
      GET: async () => {
        return Response.json(await listStacks())
      },
    },
  },
})
