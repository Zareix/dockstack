import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { redeployAllRunningStacks } from '#/lib/docker'

export const Route = createFileRoute('/api/stacks/redeploy')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get('x-api-key')
        if (!apiKey) {
          return Response.json(
            { error: 'No API key provided' },
            { status: 401 },
          )
        }
        const data = await auth.api.verifyApiKey({
          body: {
            key: apiKey,
          },
        })
        if (!data.valid) {
          return Response.json({ error: data.error }, { status: 401 })
        }
        const results = await redeployAllRunningStacks()
        return Response.json(results)
      },
    },
  },
})
