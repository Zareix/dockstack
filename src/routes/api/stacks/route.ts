import { createFileRoute } from '@tanstack/react-router'
import { getStackStatus, listStacks } from '#/lib/docker'

export const Route = createFileRoute('/api/stacks')({
  server: {
    handlers: {
      middleware: [apiKeyMiddleware],
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
