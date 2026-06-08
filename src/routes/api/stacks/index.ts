import { createFileRoute } from '@tanstack/react-router'
import { getStackStatus, listStacks } from '#/lib/docker'
import { apiKeyMiddleware, loggingMiddleware } from '#/lib/middleware'

export const Route = createFileRoute('/api/stacks/')({
  server: {
    middleware: [loggingMiddleware, apiKeyMiddleware],
    handlers: {
      GET: async () => {
        const names = await listStacks()
        return Response.json(
          await Promise.all(
            names.map(async (name) => ({
              name,
              status: await getStackStatus(name),
            })),
          ),
        )
      },
    },
  },
})
